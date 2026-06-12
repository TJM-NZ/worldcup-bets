'use client';

import { useState } from 'react';
import { Match, Team, Prediction } from '@/lib/types';
import { isDrawAvailable } from '@/lib/betting';
import GemBadge from './GemBadge';

interface BetFormProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  memberId: string;
  memberGems: number;
  onBetPlaced: () => void;
}

export default function BetForm({ match, homeTeam, awayTeam, memberId, memberGems, onBetPlaced }: BetFormProps) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [gems, setGems] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const showDraw = isDrawAvailable(match.stage);
  const maxGems = memberGems;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prediction) return;
    if (gems < 10 || gems > maxGems) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          matchId: match.id,
          prediction,
          gemsWagered: gems,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to place bet');
        return;
      }

      onBetPlaced();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const options: { value: Prediction; label: string }[] = [
    { value: 'HOME', label: homeTeam?.tla || homeTeam?.name || 'Home' },
    { value: 'AWAY', label: awayTeam?.tla || awayTeam?.name || 'Away' },
  ];
  if (showDraw) {
    options.push({ value: 'DRAW', label: 'Draw' });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-silver">Your balance:</span>
        <GemBadge gems={memberGems} />
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: showDraw ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPrediction(opt.value)}
            className={`rounded-lg border-2 p-3 text-center font-semibold transition-colors ${
              prediction === opt.value
                ? 'border-accent bg-accent/20 text-accent'
                : 'border-card-hover bg-card hover:border-silver'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm text-silver mb-1">
          Wager (min 10, max {maxGems})
        </label>
        <input
          type="range"
          min={10}
          max={maxGems}
          step={10}
          value={gems}
          onChange={(e) => setGems(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-sm mt-1">
          <span>10</span>
          <GemBadge gems={gems} size="sm" />
          <span>{maxGems}</span>
        </div>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={!prediction || loading || gems < 10 || gems > maxGems}
        className="w-full rounded-lg bg-accent px-4 py-3 font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Placing bet...' : `Bet ${gems} gems on ${prediction || '...'}`}
      </button>
    </form>
  );
}
