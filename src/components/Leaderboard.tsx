"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PointsBadge from "./PointsBadge";

interface LeaderboardEntry {
  id: string;
  display_name: string;
  points: number;
  is_ai: boolean;
  ai_model: string | null;
  crestUrl?: string;
  teamName?: string;
  gamesWon: number;
  gamesLost: number;
  gamesPending: number;
  exactScoreWins: number;
}

function pct(num: number, denom: number): string | null {
  if (denom === 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

export default function Leaderboard({
  workspaceId,
  currentMemberId,
}: {
  workspaceId: string;
  currentMemberId?: string;
}) {
  const [members, setMembers] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: memberData } = await supabase
        .from("members")
        .select("id, display_name, points, is_ai, ai_model, winner_picks(teams(crest_url, name))")
        .or(`workspace_id.eq.${workspaceId},is_global.eq.true`);

      if (!memberData) return;

      const memberIds = memberData.map((m) => m.id);

      type BetStats = {
        gamesWon: number;
        gamesLost: number;
        gamesPending: number;
        exactScoreWins: number;
      };

      const stats: Record<string, BetStats> = Object.fromEntries(
        memberIds.map((id) => [
          id,
          { gamesWon: 0, gamesLost: 0, gamesPending: 0, exactScoreWins: 0 },
        ])
      );

      if (memberIds.length > 0) {
        const { data: bets } = await supabase
          .from("bets")
          .select("member_id, points_won, resolved")
          .in("member_id", memberIds);

        for (const bet of bets ?? []) {
          const s = stats[bet.member_id];
          if (!s) continue;
          if (!bet.resolved) {
            s.gamesPending++;
          } else if (bet.points_won > 0) {
            s.gamesWon++;
          } else {
            s.gamesLost++;
          }
        }

        const { data: scoreBets } = await supabase
          .from("exact_score_bets")
          .select("member_id, points_won, resolved")
          .in("member_id", memberIds);

        for (const bet of scoreBets ?? []) {
          const s = stats[bet.member_id];
          if (!s) continue;
          if (bet.resolved && bet.points_won > 0) {
            s.exactScoreWins++;
          }
        }
      }

      const entries = memberData.map((m) => {
        const pick = Array.isArray(m.winner_picks) ? m.winner_picks[0] : m.winner_picks;
        const team = pick?.teams as { crest_url?: string; name?: string } | null | undefined;
        return {
          ...m,
          ...stats[m.id],
          crestUrl: team?.crest_url ?? undefined,
          teamName: team?.name ?? undefined,
        };
      });

      // Ensure AI members without bets still show default stats
      for (const entry of entries) {
        if (!stats[entry.id]) {
          entry.gamesWon = 0;
          entry.gamesLost = 0;
          entry.gamesPending = 0;
          entry.exactScoreWins = 0;
        }
      }

      entries.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const aRate = a.gamesWon + a.gamesLost > 0 ? a.gamesWon / (a.gamesWon + a.gamesLost) : -1;
        const bRate = b.gamesWon + b.gamesLost > 0 ? b.gamesWon / (b.gamesWon + b.gamesLost) : -1;
        return bRate - aRate;
      });

      setMembers(entries);
    }

    load();

    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "exact_score_bets" }, () =>
        load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const medalColors = ["text-gold", "text-silver", "text-bronze"];

  return (
    <div className="space-y-2">
      {members.map((member, i) => {
        const resolvedGames = member.gamesWon + member.gamesLost;
        const winRate = pct(member.gamesWon, resolvedGames);

        return (
          <div
            key={member.id}
            className={`rounded-lg p-3 ${
              member.id === currentMemberId ? "bg-accent/10 border-accent/30 border" : "bg-card"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-8 shrink-0 text-center text-lg font-bold ${i < 3 ? medalColors[i] : "text-silver"}`}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                {member.is_ai ? (
                  <span className="shrink-0 text-base">🤖</span>
                ) : (
                  member.crestUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.crestUrl}
                      alt={member.teamName || ""}
                      className="h-5 w-5 shrink-0 object-contain"
                      title={member.teamName}
                    />
                  )
                )}
                <span className="truncate">
                  {member.display_name}
                  {member.is_ai && (
                    <span className="text-silver ml-1.5 text-xs font-normal">AI</span>
                  )}
                  {member.id === currentMemberId && !member.is_ai && (
                    <span className="text-silver ml-2 text-xs">(you)</span>
                  )}
                </span>
              </span>
              <PointsBadge points={member.points} size="sm" />
            </div>

            {member.gamesWon + member.gamesLost + member.gamesPending > 0 && (
              <div className="mt-2 ml-11 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-silver font-medium">Picks</span>
                  <span className="text-emerald-500 dark:text-emerald-400">{member.gamesWon}W</span>
                  <span className="text-red-500 dark:text-red-400">{member.gamesLost}L</span>
                  {member.gamesPending > 0 && (
                    <span className="text-silver">{member.gamesPending}P</span>
                  )}
                  {winRate && (
                    <>
                      <span className="text-silver">·</span>
                      <span className="text-silver">{winRate}</span>
                    </>
                  )}
                </div>
                {member.exactScoreWins > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-accent">★</span>
                    <span className="text-silver">{member.exactScoreWins} exact</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {members.length === 0 && <p className="text-silver py-8 text-center">No members yet</p>}
    </div>
  );
}
