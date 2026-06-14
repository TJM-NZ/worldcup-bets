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
  const { memberId, matchId, predictedHome, predictedAway } = body as {
    memberId: string;
    matchId: number;
    predictedHome: number;
    predictedAway: number;
  };

  if (!memberId || !matchId || predictedHome == null || predictedAway == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { data: bet, error: betError } = await supabase
    .from("exact_score_bets")
    .insert({
      member_id: memberId,
      match_id: matchId,
      predicted_home: predictedHome,
      predicted_away: predictedAway,
    })
    .select()
    .single();

  if (betError) {
    return NextResponse.json(
      { error: `Failed to place bet: ${betError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ bet });
}
