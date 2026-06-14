"use client";

import { useState } from "react";
import { Match, Team, Prediction } from "@/lib/types";
import { isDrawAvailable, RESULT_POINTS } from "@/lib/betting";

interface BetFormProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  memberId: string;
  onBetPlaced: () => void;
  initialPrediction?: Prediction;
}

export default function BetForm({
  match,
  homeTeam,
  awayTeam,
  memberId,
  onBetPlaced,
  initialPrediction,
}: BetFormProps) {
  const [prediction, setPrediction] = useState<Prediction | null>(initialPrediction ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showDraw = isDrawAvailable(match.stage);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prediction) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, matchId: match.id, prediction }),
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

  const options: { value: Prediction; label: string }[] = [
    { value: "HOME", label: homeTeam?.tla || homeTeam?.name || "Home" },
    { value: "AWAY", label: awayTeam?.tla || awayTeam?.name || "Away" },
  ];
  if (showDraw) {
    options.push({ value: "DRAW", label: "Draw" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: showDraw ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPrediction(opt.value)}
            className={`rounded-lg border-2 p-3 text-center transition-colors ${
              prediction === opt.value
                ? "border-accent bg-accent/20 text-accent"
                : "border-card-hover bg-card hover:border-silver"
            }`}
          >
            <span className="font-semibold">{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-background flex items-center justify-between rounded-lg px-3 py-2 text-sm">
        <span className="text-silver">Points if correct</span>
        <span className="text-accent font-bold">+{RESULT_POINTS} pts</span>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={!prediction || loading}
        className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Placing bet..." : prediction ? `Predict ${prediction}` : "Pick a result"}
      </button>
    </form>
  );
}
