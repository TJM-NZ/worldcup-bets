"use client";

import { useState } from "react";
import { Match, Team } from "@/lib/types";
import { EXACT_SCORE_MULTIPLIER } from "@/lib/betting";
import GemBadge from "./GemBadge";

interface ScoreBetFormProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  memberId: string;
  memberGems: number;
  onBetPlaced: () => void;
}

export default function ScoreBetForm({
  match,
  homeTeam,
  awayTeam,
  memberId,
  memberGems,
  onBetPlaced,
}: ScoreBetFormProps) {
  const [homeScore, setHomeScore] = useState(1);
  const [awayScore, setAwayScore] = useState(1);
  const [gems, setGems] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const potentialPayout = gems * EXACT_SCORE_MULTIPLIER;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (gems < 10 || gems > memberGems) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/score-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          matchId: match.id,
          predictedHome: homeScore,
          predictedAway: awayScore,
          gemsWagered: gems,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to place bet");
        return;
      }

      onBetPlaced();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-silver text-sm">Your balance:</span>
        <GemBadge gems={memberGems} />
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-silver text-xs">{homeTeam?.tla || homeTeam?.name || "Home"}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHomeScore((v) => Math.max(0, v - 1))}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold"
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold">{homeScore}</span>
            <button
              type="button"
              onClick={() => setHomeScore((v) => Math.min(20, v + 1))}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold"
            >
              +
            </button>
          </div>
        </div>

        <span className="text-silver text-xl">–</span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-silver text-xs">{awayTeam?.tla || awayTeam?.name || "Away"}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAwayScore((v) => Math.max(0, v - 1))}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold"
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold">{awayScore}</span>
            <button
              type="button"
              onClick={() => setAwayScore((v) => Math.min(20, v + 1))}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-silver mb-1 block text-sm">Wager (min 10, max {memberGems})</label>
        <input
          type="range"
          min={10}
          max={memberGems}
          step={10}
          value={gems}
          onChange={(e) => setGems(Number(e.target.value))}
          className="accent-accent w-full"
        />
        <div className="mt-1 flex justify-between text-sm">
          <span>10</span>
          <GemBadge gems={gems} size="sm" />
          <span>{memberGems}</span>
        </div>
      </div>

      <div className="bg-background flex items-center justify-between rounded-lg px-3 py-2 text-sm">
        <span className="text-silver">Payout if correct ({EXACT_SCORE_MULTIPLIER}x fixed)</span>
        <GemBadge gems={potentialPayout} size="sm" />
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || gems < 10 || gems > memberGems}
        className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Placing bet..." : `Bet ${gems} gems on ${homeScore}–${awayScore}`}
      </button>
    </form>
  );
}
