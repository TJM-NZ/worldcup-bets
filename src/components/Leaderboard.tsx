"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
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

interface MatchBet {
  matchId: number;
  matchDate: string;
  homeLabel: string;
  awayLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  // result pick
  hasResult: boolean;
  prediction?: string;
  resultResolved: boolean;
  resultPointsWon: number;
  // score pick
  hasScore: boolean;
  predictedHome?: number;
  predictedAway?: number;
  scoreResolved: boolean;
  scorePointsWon: number;
}

function pct(num: number, denom: number): string | null {
  if (denom === 0) return null;
  return `${Math.round((num / denom) * 100)}%`;
}

function predictionLabel(prediction: string, homeLabel: string, awayLabel: string): string {
  if (prediction === "HOME") return homeLabel;
  if (prediction === "AWAY") return awayLabel;
  return "Draw";
}

export default function Leaderboard({
  workspaceId,
  currentMemberId,
}: {
  workspaceId: string;
  currentMemberId?: string;
}) {
  const { teams } = useWorkspace();
  const [members, setMembers] = useState<LeaderboardEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [betsCache, setBetsCache] = useState<Record<string, MatchBet[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const [{ data: bets }, { data: scoreBets }] = await Promise.all([
          supabase
            .from("bets")
            .select("member_id, points_won, resolved")
            .in("member_id", memberIds),
          supabase
            .from("exact_score_bets")
            .select("member_id, points_won, resolved")
            .in("member_id", memberIds),
        ]);

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

    function scheduleReload() {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 500);
    }

    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, scheduleReload)
      // UPDATE only: bet resolution changes points/won/lost; new bets (INSERT) only shift
      // pending count which doesn't warrant a full leaderboard reload
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bets" }, scheduleReload)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "exact_score_bets" },
        scheduleReload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [workspaceId]);

  async function loadMemberBets(memberId: string) {
    if (betsCache[memberId] !== undefined) return;

    setLoadingId(memberId);
    const supabase = createClient();

    const [betsRes, scoreBetsRes] = await Promise.all([
      supabase
        .from("bets")
        .select("match_id, prediction, points_won, resolved")
        .eq("member_id", memberId),
      supabase
        .from("exact_score_bets")
        .select("match_id, predicted_home, predicted_away, points_won, resolved")
        .eq("member_id", memberId),
    ]);

    const allMatchIds = [
      ...(betsRes.data ?? []).map((b) => b.match_id),
      ...(scoreBetsRes.data ?? []).map((b) => b.match_id),
    ];

    if (allMatchIds.length === 0) {
      setBetsCache((prev) => ({ ...prev, [memberId]: [] }));
      setLoadingId(null);
      return;
    }

    const { data: matchData } = await supabase
      .from("matches")
      .select("id, utc_date, home_team_id, away_team_id, home_score, away_score, winner")
      .in("id", allMatchIds);

    const matchMap = new Map((matchData ?? []).map((m) => [m.id, m]));

    function teamLabel(id: number | null): string {
      if (!id) return "TBD";
      const t = teams.get(id);
      return t?.tla || t?.name || "?";
    }

    // Merge result + score bets into one entry per match
    const byMatch = new Map<number, MatchBet>();

    function entryFor(matchId: number): MatchBet | null {
      const existing = byMatch.get(matchId);
      if (existing) return existing;
      const match = matchMap.get(matchId);
      if (!match) return null;
      const entry: MatchBet = {
        matchId,
        matchDate: match.utc_date,
        homeLabel: teamLabel(match.home_team_id),
        awayLabel: teamLabel(match.away_team_id),
        homeScore: match.home_score,
        awayScore: match.away_score,
        winner: match.winner,
        hasResult: false,
        resultResolved: false,
        resultPointsWon: 0,
        hasScore: false,
        scoreResolved: false,
        scorePointsWon: 0,
      };
      byMatch.set(matchId, entry);
      return entry;
    }

    for (const bet of betsRes.data ?? []) {
      const entry = entryFor(bet.match_id);
      if (!entry) continue;
      entry.hasResult = true;
      entry.prediction = bet.prediction;
      entry.resultResolved = bet.resolved;
      entry.resultPointsWon = bet.points_won;
    }

    for (const bet of scoreBetsRes.data ?? []) {
      const entry = entryFor(bet.match_id);
      if (!entry) continue;
      entry.hasScore = true;
      entry.predictedHome = bet.predicted_home;
      entry.predictedAway = bet.predicted_away;
      entry.scoreResolved = bet.resolved;
      entry.scorePointsWon = bet.points_won;
    }

    const details = [...byMatch.values()].sort((a, b) => (a.matchDate < b.matchDate ? -1 : 1));

    setBetsCache((prev) => ({ ...prev, [memberId]: details }));
    setLoadingId(null);
  }

  function toggleExpand(memberId: string) {
    if (expandedId === memberId) {
      setExpandedId(null);
    } else {
      setExpandedId(memberId);
      loadMemberBets(memberId);
    }
  }

  const medalColors = ["text-gold", "text-silver", "text-bronze"];

  return (
    <div className="space-y-2">
      {members.map((member, i) => {
        const resolvedGames = member.gamesWon + member.gamesLost;
        const winRate = pct(member.gamesWon, resolvedGames);
        const isExpanded = expandedId === member.id;
        const isLoading = loadingId === member.id;
        const betDetails = betsCache[member.id];
        const hasActivity = member.gamesWon + member.gamesLost + member.gamesPending > 0;

        return (
          <div
            key={member.id}
            className={`rounded-lg p-3 ${
              member.id === currentMemberId ? "bg-accent/10 border-accent/30 border" : "bg-card"
            }`}
          >
            <button
              className="w-full cursor-pointer text-left"
              onClick={() => toggleExpand(member.id)}
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
                <span
                  className={`text-silver text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </div>

              {hasActivity && (
                <div className="mt-2 ml-11 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-silver font-medium">Picks</span>
                    <span className="text-emerald-500 dark:text-emerald-400">
                      {member.gamesWon}W
                    </span>
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
            </button>

            {isExpanded && (
              <div className="mt-3 ml-11 border-t border-white/10 pt-3">
                {isLoading && <p className="text-silver text-xs">Loading...</p>}
                {!isLoading && betDetails?.length === 0 && (
                  <p className="text-silver text-xs">No bets yet</p>
                )}
                {!isLoading && betDetails && betDetails.length > 0 && (
                  <div className="space-y-1.5">
                    {betDetails.map((bet) => {
                      const hasResultScore = bet.homeScore !== null && bet.awayScore !== null;
                      // A stored draw with a decisive winner means it was settled on penalties
                      const wonOnPens =
                        hasResultScore &&
                        bet.homeScore === bet.awayScore &&
                        (bet.winner === "HOME_TEAM" || bet.winner === "AWAY_TEAM");
                      return (
                        <div key={bet.matchId} className="flex items-center gap-2 text-xs">
                          <span className="text-silver min-w-0 flex-1 truncate">
                            {bet.homeLabel} vs {bet.awayLabel}
                          </span>
                          <span className="shrink-0 font-mono font-medium">
                            {hasResultScore ? `${bet.homeScore}–${bet.awayScore}` : "–"}
                            {wonOnPens && (
                              <span className="text-silver ml-1 font-sans font-normal">
                                ({bet.winner === "HOME_TEAM" ? bet.homeLabel : bet.awayLabel} pens)
                              </span>
                            )}
                          </span>
                          {bet.hasResult && (
                            <span className="flex shrink-0 items-center gap-0.5 font-mono">
                              <span className="text-silver">
                                {predictionLabel(bet.prediction!, bet.homeLabel, bet.awayLabel)}
                              </span>
                              {!bet.resultResolved ? (
                                <span className="text-silver">–</span>
                              ) : bet.resultPointsWon > 0 ? (
                                <span className="text-emerald-500 dark:text-emerald-400">✓</span>
                              ) : (
                                <span className="text-red-500 dark:text-red-400">✗</span>
                              )}
                            </span>
                          )}
                          {bet.hasScore && (
                            <span className="flex shrink-0 items-center gap-0.5 font-mono">
                              <span className="text-silver">
                                {bet.predictedHome}–{bet.predictedAway}
                              </span>
                              {!bet.scoreResolved ? (
                                <span className="text-silver">–</span>
                              ) : bet.scorePointsWon > 0 ? (
                                <span className="text-accent">★</span>
                              ) : (
                                <span className="text-red-500 dark:text-red-400">✗</span>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })}
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
