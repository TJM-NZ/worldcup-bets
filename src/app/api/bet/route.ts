import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isBettingOpen, isDrawAvailable } from "@/lib/betting";
import { Prediction } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { memberId, matchId, prediction, gemsWagered } = body as {
    memberId: string;
    matchId: number;
    prediction: Prediction;
    gemsWagered: number;
  };

  if (!memberId || !matchId || !prediction || !gemsWagered) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (gemsWagered < 10) {
    return NextResponse.json({ error: "Minimum wager is 10 gems" }, { status: 400 });
  }

  if (!["HOME", "AWAY", "DRAW"].includes(prediction)) {
    return NextResponse.json({ error: "Invalid prediction" }, { status: 400 });
  }

  const supabase = createServiceClient();

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

  // Extra check: don't allow bets if match time has passed
  if (new Date(match.utc_date) <= new Date()) {
    return NextResponse.json({ error: "Match has already started" }, { status: 400 });
  }

  // Check draw availability
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
    .from("bets")
    .insert({
      member_id: memberId,
      match_id: matchId,
      prediction,
      gems_wagered: gemsWagered,
    })
    .select()
    .single();

  if (betError) {
    // Refund gems if bet insert fails
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
