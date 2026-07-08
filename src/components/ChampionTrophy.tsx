"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PointsBadge from "./PointsBadge";

/** Synthesize a short triumphant fanfare via the Web Audio API — no asset needed. */
function playFanfare() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 arpeggio
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Web Audio unavailable — silently skip the sound.
  }
}

/** Speak the champion's name aloud via the browser's SpeechSynthesis API. */
function announceChampion(name: string) {
  try {
    const utter = new SpeechSynthesisUtterance(`${name} is the champion!`);
    utter.rate = 0.95;
    utter.pitch = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    // SpeechSynthesis unavailable — silently skip.
  }
}

interface Champion {
  display_name: string;
  is_ai: boolean;
  points: number;
  crestUrl?: string;
  teamName?: string;
}

/**
 * Shows a trophy with the pool leader's name once the tournament is over
 * (i.e. the FINAL has finished). Renders nothing until then. The champion is
 * the top of the leaderboard, using the same points-then-win-rate ordering as
 * the Leaderboard component so the two never disagree.
 */
export default function ChampionTrophy({ workspaceId }: { workspaceId: string }) {
  const [champion, setChampion] = useState<Champion | null>(null);
  const [spinning, setSpinning] = useState(false);

  function celebrate() {
    if (!champion) return;
    setSpinning(true);
    playFanfare();
    // Let the fanfare lead, then announce the name over it.
    setTimeout(() => announceChampion(champion.display_name), 500);
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      // The tournament is over once the FINAL has finished.
      const { data: finalMatch } = await supabase
        .from("matches")
        .select("status")
        .eq("stage", "FINAL")
        .maybeSingle();

      if (!finalMatch || finalMatch.status !== "FINISHED") {
        if (!cancelled) setChampion(null);
        return;
      }

      const { data: memberData } = await supabase
        .from("members")
        .select("id, display_name, points, is_ai, winner_picks(teams(crest_url, name))")
        .or(`workspace_id.eq.${workspaceId},is_global.eq.true`);

      if (!memberData || memberData.length === 0) {
        if (!cancelled) setChampion(null);
        return;
      }

      const memberIds = memberData.map((m) => m.id);

      // Win/loss counts drive the tiebreak when points are level (mirrors Leaderboard).
      const { data: bets } = await supabase
        .from("bets")
        .select("member_id, points_won, resolved")
        .in("member_id", memberIds);

      const record: Record<string, { won: number; lost: number }> = Object.fromEntries(
        memberIds.map((id) => [id, { won: 0, lost: 0 }])
      );
      for (const bet of bets ?? []) {
        const r = record[bet.member_id];
        if (!r || !bet.resolved) continue;
        if (bet.points_won > 0) r.won++;
        else r.lost++;
      }

      const winRate = (id: string) => {
        const r = record[id];
        const played = r.won + r.lost;
        return played > 0 ? r.won / played : -1;
      };

      const sorted = [...memberData].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return winRate(b.id) - winRate(a.id);
      });

      const top = sorted[0];
      const pick = Array.isArray(top.winner_picks) ? top.winner_picks[0] : top.winner_picks;
      const team = pick?.teams as { crest_url?: string; name?: string } | null | undefined;

      if (!cancelled) {
        setChampion({
          display_name: top.display_name,
          is_ai: top.is_ai,
          points: top.points,
          crestUrl: team?.crest_url ?? undefined,
          teamName: team?.name ?? undefined,
        });
      }
    }

    load();

    // Re-check when the final finishes live or points shift a resolved-match tie.
    const channel = supabase
      .channel("champion")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  if (!champion) return null;

  return (
    <section className="border-gold/30 bg-card relative overflow-hidden rounded-xl border p-8 text-center">
      <p className="text-silver text-xs font-semibold tracking-[0.2em] uppercase">
        Tournament Champion
      </p>

      <button
        type="button"
        onClick={celebrate}
        title="Celebrate the champion"
        aria-label="Celebrate the champion"
        className="mx-auto mt-3 block cursor-pointer transition-transform hover:scale-105 active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          onAnimationEnd={() => setSpinning(false)}
          className={`text-gold h-20 w-20 drop-shadow ${spinning ? "animate-trophy-spin" : ""}`}
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="currentColor" fillOpacity={0.15} />
        </svg>
      </button>

      {/* Engraved nameplate */}
      <div className="border-gold/40 from-gold/20 to-gold/5 mx-auto mt-4 inline-flex items-center gap-2 rounded-md border bg-gradient-to-b px-5 py-2 shadow-inner">
        {champion.is_ai ? (
          <span className="text-lg">🤖</span>
        ) : (
          champion.crestUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={champion.crestUrl}
              alt={champion.teamName || ""}
              className="h-6 w-6 shrink-0 object-contain"
              title={champion.teamName}
            />
          )
        )}
        <span className="text-gold text-xl font-bold tracking-wide">{champion.display_name}</span>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <PointsBadge points={champion.points} size="sm" />
      </div>
    </section>
  );
}
