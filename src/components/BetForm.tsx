"use client";

import { useState } from "react";
import { Match, Team, Prediction } from "@/lib/types";
import { isDrawAvailable, calculateOdds, calculateProbabilities } from "@/lib/betting";
import GemBadge from "./GemBadge";

interface BetFormProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  memberId: string;
  memberGems: number;
  pools: Record<Prediction, number>;
  onBetPlaced: () => void;
}

export default function BetForm({
  match,
  homeTeam,
  awayTeam,
  memberId,
  memberGems,
  pools,
  onBetPlaced,
}: BetFormProps) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [gems, setGems] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const showDraw = isDrawAvailable(match.stage);
  const maxGems = memberGems;

  // Calculate odds/probabilities from current pools, and preview odds including user's wager
  const currentOdds = calculateOdds(pools);
  const currentProbs = calculateProbabilities(pools);
  const previewPools: Record<Prediction, number> = prediction
    ? { ...pools, [prediction]: pools[prediction] + gems }
    : pools;
  const previewOdds = prediction ? calculateOdds(previewPools) : currentOdds;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prediction) return;
    if (gems < 10 || gems > maxGems) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          matchId: match.id,
          prediction,
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

  const options: { value: Prediction; label: string }[] = [
    { value: "HOME", label: homeTeam?.tla || homeTeam?.name || "Home" },
    { value: "AWAY", label: awayTeam?.tla || awayTeam?.name || "Away" },
  ];
  if (showDraw) {
    options.push({ value: "DRAW", label: "Draw" });
  }

  const potentialPayout =
    prediction && previewOdds[prediction] != null
      ? Math.floor(gems * previewOdds[prediction])
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-silver text-sm">Your balance:</span>
        <GemBadge gems={memberGems} />
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: showDraw ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}
      >
        {options.map((opt) => {
          const mult = currentOdds[opt.value];
          const prob = currentProbs[opt.value];
          return (
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
              {prob != null && <span className="mt-0.5 block text-sm font-bold">{prob}%</span>}
              {mult != null && (
                <span className="text-silver block text-xs">{mult.toFixed(1)}x</span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-silver mb-1 block text-sm">Wager (min 10, max {maxGems})</label>
        <input
          type="range"
          min={10}
          max={maxGems}
          step={10}
          value={gems}
          onChange={(e) => setGems(Number(e.target.value))}
          className="accent-accent w-full"
        />
        <div className="mt-1 flex justify-between text-sm">
          <span>10</span>
          <GemBadge gems={gems} size="sm" />
          <span>{maxGems}</span>
        </div>
      </div>

      {prediction && potentialPayout != null && (
        <div className="bg-background flex items-center justify-between rounded-lg px-3 py-2 text-sm">
          <span className="text-silver">Potential payout</span>
          <GemBadge gems={potentialPayout} size="sm" />
        </div>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={!prediction || loading || gems < 10 || gems > maxGems}
        className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Placing bet..." : `Bet ${gems} gems on ${prediction || "..."}`}
      </button>
    </form>
  );
}
