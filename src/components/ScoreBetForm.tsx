"use client";

import { useState } from "react";
import { Match, Team } from "@/lib/types";
import { EXACT_SCORE_POINTS } from "@/lib/betting";

interface ScoreBetFormProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  memberId: string;
  onBetPlaced: () => void;
}

export default function ScoreBetForm({
  match,
  homeTeam,
  awayTeam,
  memberId,
  onBetPlaced,
}: ScoreBetFormProps) {
  const [homeScore, setHomeScore] = useState(1);
  const [awayScore, setAwayScore] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

      <div className="bg-background flex items-center justify-between rounded-lg px-3 py-2 text-sm">
        <span className="text-silver">Points if exact</span>
        <span className="text-accent font-bold">+{EXACT_SCORE_POINTS} pts</span>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Placing bet..." : `Predict ${homeScore}–${awayScore}`}
      </button>
    </form>
  );
}
