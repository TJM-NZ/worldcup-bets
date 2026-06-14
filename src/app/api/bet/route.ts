import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isBettingOpen, isDrawAvailable } from "@/lib/betting";
import { Prediction } from "@/lib/types";

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { memberId, matchId, prediction } = body as {
    memberId: string;
    matchId: number;
    prediction: Prediction;
  };

  if (!memberId || !matchId || !prediction) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["HOME", "AWAY", "DRAW"].includes(prediction)) {
    return NextResponse.json({ error: "Invalid prediction" }, { status: 400 });
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
    .select("id, status, stage, utc_date")
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

  if (prediction === "DRAW" && !isDrawAvailable(match.stage)) {
    return NextResponse.json(
      { error: "Draw prediction not available for knockout matches" },
      { status: 400 }
    );
  }

  // Check for existing bet
  const { data: existingBet } = await supabase
    .from("bets")
    .select("id")
    .eq("member_id", memberId)
    .eq("match_id", matchId)
    .single();

  if (existingBet) {
    return NextResponse.json({ error: "You already placed a bet on this match" }, { status: 400 });
  }

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({ member_id: memberId, match_id: matchId, prediction })
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
