"use client";

import { useState } from "react";
import { Match, Team, Prediction } from "@/lib/types";
import { EXACT_SCORE_POINTS } from "@/lib/betting";

interface ScoreBetFormProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  memberId: string;
  onBetPlaced: () => void;
  prediction: Prediction;
}

export default function ScoreBetForm({
  match,
  homeTeam,
  awayTeam,
  memberId,
  onBetPlaced,
  prediction,
}: ScoreBetFormProps) {
  const [homeScore, setHomeScore] = useState(() => (prediction === "AWAY" ? 0 : 1));
  const [awayScore, setAwayScore] = useState(() => (prediction === "HOME" ? 0 : 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function adjustHome(delta: number) {
    const next = Math.max(0, Math.min(20, homeScore + delta));
    if (prediction === "HOME") {
      // home must stay > away
      setHomeScore(Math.max(awayScore + 1, next));
    } else if (prediction === "AWAY") {
      // home must stay < away
      setHomeScore(Math.min(awayScore - 1, next));
    } else {
      // DRAW: keep both equal
      setHomeScore(next);
      setAwayScore(next);
    }
  }

  function adjustAway(delta: number) {
    const next = Math.max(0, Math.min(20, awayScore + delta));
    if (prediction === "AWAY") {
      // away must stay > home
      setAwayScore(Math.max(homeScore + 1, next));
    } else if (prediction === "HOME") {
      // away must stay < home
      setAwayScore(Math.min(homeScore - 1, next));
    } else {
      // DRAW: keep both equal
      setAwayScore(next);
      setHomeScore(next);
    }
  }

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
              onClick={() => adjustHome(-1)}
              disabled={prediction === "HOME" ? homeScore <= awayScore + 1 : homeScore <= 0}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold">{homeScore}</span>
            <button
              type="button"
              onClick={() => adjustHome(1)}
              disabled={prediction === "AWAY" ? homeScore >= awayScore - 1 : homeScore >= 20}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold disabled:opacity-30"
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
              onClick={() => adjustAway(-1)}
              disabled={prediction === "AWAY" ? awayScore <= homeScore + 1 : awayScore <= 0}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold">{awayScore}</span>
            <button
              type="button"
              onClick={() => adjustAway(1)}
              disabled={prediction === "HOME" ? awayScore >= homeScore - 1 : awayScore >= 20}
              className="bg-card-hover h-8 w-8 rounded text-lg leading-none font-bold disabled:opacity-30"
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
