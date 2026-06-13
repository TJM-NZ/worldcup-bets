import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isBettingOpen } from "@/lib/betting";

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { memberId, matchId, predictedHome, predictedAway, gemsWagered } = body as {
    memberId: string;
    matchId: number;
    predictedHome: number;
    predictedAway: number;
    gemsWagered: number;
  };

  if (!memberId || !matchId || predictedHome == null || predictedAway == null || !gemsWagered) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (gemsWagered < 10) {
    return NextResponse.json({ error: "Minimum wager is 10 gems" }, { status: 400 });
  }

  if (
    !Number.isInteger(predictedHome) ||
    !Number.isInteger(predictedAway) ||
    predictedHome < 0 ||
    predictedAway < 0
  ) {
    return NextResponse.json({ error: "Invalid score prediction" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the memberId belongs to the authenticated user
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify match exists and is open for betting
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, status, utc_date")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (!isBettingOpen(match.status)) {
    return NextResponse.json({ error: "Betting is closed for this match" }, { status: 400 });
  }

  if (new Date(match.utc_date) <= new Date()) {
    return NextResponse.json({ error: "Match has already started" }, { status: 400 });
  }

  // Check for existing exact score bet
  const { data: existingBet } = await supabase
    .from("exact_score_bets")
    .select("id")
    .eq("member_id", memberId)
    .eq("match_id", matchId)
    .single();

  if (existingBet) {
    return NextResponse.json(
      { error: "You already placed a score bet on this match" },
      { status: 400 }
    );
  }

  // Deduct gems atomically
  const { data: deducted } = await supabase.rpc("decrement_gems", {
    p_member_id: memberId,
    p_amount: gemsWagered,
  });

  if (!deducted) {
    return NextResponse.json({ error: "Insufficient gems" }, { status: 400 });
  }

  // Place bet
  const { data: bet, error: betError } = await supabase
    .from("exact_score_bets")
    .insert({
      member_id: memberId,
      match_id: matchId,
      predicted_home: predictedHome,
      predicted_away: predictedAway,
      gems_wagered: gemsWagered,
    })
    .select()
    .single();

  if (betError) {
    await supabase.rpc("increment_gems", {
      p_member_id: memberId,
      p_amount: gemsWagered,
    });
    return NextResponse.json(
      { error: `Failed to place bet: ${betError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ bet });
}
