"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GemBadge from "./GemBadge";

interface LeaderboardEntry {
  id: string;
  display_name: string;
  gems: number;
  crestUrl?: string;
  teamName?: string;
  // Games: based on prediction correctness (all bets)
  gamesWon: number;
  gamesLost: number;
  gamesPending: number;
  // Gems: based on gem profit (resolved bets only)
  gemWins: number;
  gemDraws: number;
  gemLosses: number;
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
        .select("id, display_name, gems, winner_picks(teams(crest_url, name))")
        .eq("workspace_id", workspaceId)
        .order("gems", { ascending: false });

      if (!memberData) return;

      const memberIds = memberData.map((m) => m.id);

      type BetStats = {
        gamesWon: number;
        gamesLost: number;
        gamesPending: number;
        gemWins: number;
        gemDraws: number;
        gemLosses: number;
      };

      const stats: Record<string, BetStats> = Object.fromEntries(
        memberIds.map((id) => [
          id,
          { gamesWon: 0, gamesLost: 0, gamesPending: 0, gemWins: 0, gemDraws: 0, gemLosses: 0 },
        ])
      );

      if (memberIds.length > 0) {
        const { data: bets } = await supabase
          .from("bets")
          .select("member_id, gems_wagered, gems_won, resolved")
          .in("member_id", memberIds);

        for (const bet of bets ?? []) {
          const s = stats[bet.member_id];
          if (!s) continue;

          if (!bet.resolved) {
            s.gamesPending++;
          } else if (bet.gems_won > 0) {
            s.gamesWon++;
            if (bet.gems_won > bet.gems_wagered) s.gemWins++;
            else s.gemDraws++;
          } else {
            s.gamesLost++;
            s.gemLosses++;
          }
        }
      }

      setMembers(
        memberData.map((m) => {
          const pick = Array.isArray(m.winner_picks) ? m.winner_picks[0] : m.winner_picks;
          const team = pick?.teams as { crest_url?: string; name?: string } | null | undefined;
          return {
            ...m,
            ...stats[m.id],
            crestUrl: team?.crest_url ?? undefined,
            teamName: team?.name ?? undefined,
          };
        })
      );
    }

    load();

    const channel = supabase
      .channel("leaderboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => load()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const medalColors = ["text-gold", "text-silver", "text-bronze"];

  return (
    <div className="space-y-2">
      {members.map((member, i) => {
        const totalGames = member.gamesWon + member.gamesLost + member.gamesPending;
        const resolvedGames = member.gamesWon + member.gamesLost;
        const resolvedGems = member.gemWins + member.gemDraws + member.gemLosses;
        const gameWinRate = pct(member.gamesWon, resolvedGames);
        const gemWinRate = pct(member.gemWins, resolvedGems);

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
                {member.crestUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.crestUrl}
                    alt={member.teamName || ""}
                    className="h-5 w-5 shrink-0 object-contain"
                    title={member.teamName}
                  />
                )}
                <span className="truncate">
                  {member.display_name}
                  {member.id === currentMemberId && (
                    <span className="text-silver ml-2 text-xs">(you)</span>
                  )}
                </span>
              </span>
              <GemBadge gems={member.gems} size="sm" />
            </div>

            {totalGames > 0 && (
              <div className="mt-2 ml-11 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-silver font-medium">Games</span>
                  <span className="text-emerald-500 dark:text-emerald-400">{member.gamesWon}W</span>
                  <span className="text-red-500 dark:text-red-400">{member.gamesLost}L</span>
                  {member.gamesPending > 0 && (
                    <span className="text-silver">{member.gamesPending}P</span>
                  )}
                  {gameWinRate && (
                    <>
                      <span className="text-silver">·</span>
                      <span className="text-silver">{gameWinRate}</span>
                    </>
                  )}
                </div>

                {resolvedGems > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-silver font-medium">Gems</span>
                    <span className="text-emerald-500 dark:text-emerald-400">
                      {member.gemWins}W
                    </span>
                    <span className="text-red-500 dark:text-red-400">{member.gemLosses}L</span>
                    {member.gemDraws > 0 && <span className="text-silver">{member.gemDraws}D</span>}
                    {gemWinRate && (
                      <>
                        <span className="text-silver">·</span>
                        <span className="text-silver">{gemWinRate}</span>
                      </>
                    )}
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
