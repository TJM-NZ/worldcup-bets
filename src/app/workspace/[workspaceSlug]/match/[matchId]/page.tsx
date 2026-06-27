"use client";

import { useEffect, useRef, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Match, Bet, Prediction, ExactScoreBet, ExactScoreBetWithMember } from "@/lib/types";
import { isBettingOpen, isDrawAvailable, RESULT_POINTS, EXACT_SCORE_POINTS } from "@/lib/betting";
import BetForm from "@/components/BetForm";
import ScoreBetForm from "@/components/ScoreBetForm";
import CountdownTimer from "@/components/CountdownTimer";

export default function MatchDetailPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const router = useRouter();
  const { workspace, member, teams } = useWorkspace();
  const [match, setMatch] = useState<Match | null>(null);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [allBets, setAllBets] = useState<Array<Bet & { member: { display_name: string } }>>([]);
  const [userScoreBet, setUserScoreBet] = useState<ExactScoreBet | null>(null);
  const [allScoreBets, setAllScoreBets] = useState<ExactScoreBetWithMember[]>([]);
  const [fadeKey, setFadeKey] = useState(0);
  const [fadePrediction, setFadePrediction] = useState<Prediction | null>(null);
  const betFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const matchIdNum = parseInt(matchId);

    async function load() {
      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchIdNum)
        .single();

      if (!matchData) return;
      setMatch(matchData);
    }

    load();

    const channel = supabase
      .channel(`match-${matchIdNum}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchIdNum}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    const supabase = createClient();
    const matchIdNum = parseInt(matchId);

    async function loadBets() {
      const { data: myBet } = await supabase
        .from("bets")
        .select("*")
        .eq("member_id", member.id)
        .eq("match_id", matchIdNum)
        .single();

      setUserBet(myBet);

      const { data: myScoreBet } = await supabase
        .from("exact_score_bets")
        .select("*")
        .eq("member_id", member.id)
        .eq("match_id", matchIdNum)
        .single();

      setUserScoreBet(myScoreBet);

      const { data: wsMembers } = await supabase
        .from("members")
        .select("id, display_name")
        .eq("workspace_id", workspace.id);

      if (wsMembers) {
        const memberIds = wsMembers.map((m) => m.id);
        const memberMap = new Map(wsMembers.map((m) => [m.id, m]));

        const { data: betData } = await supabase
          .from("bets")
          .select("*")
          .eq("match_id", matchIdNum)
          .in("member_id", memberIds);

        if (betData) {
          setAllBets(
            betData.map((b) => ({
              ...b,
              member: memberMap.get(b.member_id) || { display_name: "Unknown" },
            }))
          );
        }

        const { data: scoreBetData } = await supabase
          .from("exact_score_bets")
          .select("*")
          .eq("match_id", matchIdNum)
          .in("member_id", memberIds);

        if (scoreBetData) {
          setAllScoreBets(
            scoreBetData.map((b) => ({
              ...b,
              member: memberMap.get(b.member_id) || { display_name: "Unknown" },
            }))
          );
        }
      }
    }

    loadBets();

    const channel = supabase
      .channel(`bets-${matchIdNum}-${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `match_id=eq.${matchIdNum}` },
        () => loadBets()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exact_score_bets",
          filter: `match_id=eq.${matchIdNum}`,
        },
        () => loadBets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, member.id, workspace.id]);

  const homeTeam = match?.home_team_id != null ? (teams.get(match.home_team_id) ?? null) : null;
  const awayTeam = match?.away_team_id != null ? (teams.get(match.away_team_id) ?? null) : null;

  if (!match) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const isOpen = isBettingOpen(match.status) && new Date(match.utc_date) > new Date();
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const showDraw = isDrawAvailable(match.stage);

  // Pick distribution (by count)
  const pickCounts: Record<Prediction, number> = { HOME: 0, AWAY: 0, DRAW: 0 };
  for (const b of allBets) {
    pickCounts[b.prediction]++;
  }
  const totalPicks = pickCounts.HOME + pickCounts.AWAY + pickCounts.DRAW;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => router.back()} className="text-silver hover:text-foreground text-sm">
        &larr; Back
      </button>

      {/* Match header */}
      <div className={`rounded-xl p-6 ${isLive ? "bg-card border-danger border-2" : "bg-card"}`}>
        <div className="text-silver mb-4 flex items-center justify-between text-sm">
          <span>{match.group_name || match.stage.replace(/_/g, " ")}</span>
          {isLive && <span className="text-danger animate-pulse font-bold">LIVE</span>}
          {isFinished && <span>Full Time</span>}
          {isOpen && <CountdownTimer targetDate={match.utc_date} />}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            {homeTeam?.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={homeTeam.crest_url}
                alt=""
                className="mx-auto mb-2 h-16 w-16 object-contain"
              />
            )}
            <p
              className={`text-lg font-bold ${match.winner === "HOME_TEAM" ? "text-success" : ""}`}
            >
              {homeTeam?.name || "TBD"}
            </p>
          </div>

          <div className="px-4 text-center">
            {match.home_score !== null && match.away_score !== null ? (
              <p className="font-mono text-4xl font-bold">
                {match.home_score} - {match.away_score}
              </p>
            ) : (
              <p className="text-silver text-2xl">vs</p>
            )}
          </div>

          <div className="flex-1 text-center">
            {awayTeam?.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={awayTeam.crest_url}
                alt=""
                className="mx-auto mb-2 h-16 w-16 object-contain"
              />
            )}
            <p
              className={`text-lg font-bold ${match.winner === "AWAY_TEAM" ? "text-success" : ""}`}
            >
              {awayTeam?.name || "TBD"}
            </p>
          </div>
        </div>

        <p className="text-silver mt-4 text-center text-sm">
          {new Date(match.utc_date).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Bet form or existing bet */}
      {isOpen && !userBet && (
        <div ref={betFormRef} className="bg-card rounded-xl p-6">
          <h3 className="mb-4 text-lg font-bold">
            {fadePrediction ? (
              <>
                Fading{" "}
                <span className="text-accent">
                  {fadePrediction === "HOME" ? homeTeam?.tla || "Home" : awayTeam?.tla || "Away"}
                </span>
              </>
            ) : (
              "Place Your Prediction"
            )}
          </h3>
          <BetForm
            key={fadeKey}
            match={match}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            memberId={member.id}
            onBetPlaced={() => window.location.reload()}
            initialPrediction={fadePrediction ?? undefined}
          />
        </div>
      )}

      {userBet && (
        <div
          className={`rounded-xl p-6 ${
            userBet.resolved
              ? userBet.points_won > 0
                ? "bg-success/10 border-success/30 border"
                : "bg-danger/10 border-danger/30 border"
              : "bg-accent/10 border-accent/30 border"
          }`}
        >
          <h3 className="mb-2 font-bold">Your Prediction</h3>
          <div className="flex items-center justify-between">
            <span>
              {userBet.prediction === "HOME"
                ? homeTeam?.name
                : userBet.prediction === "AWAY"
                  ? awayTeam?.name
                  : "Draw"}
            </span>
            {userBet.resolved ? (
              <span
                className={`font-bold ${userBet.points_won > 0 ? "text-success" : "text-danger"}`}
              >
                {userBet.points_won > 0 ? `+${userBet.points_won} pts` : "Miss"}
              </span>
            ) : (
              <span className="text-accent text-sm">+{RESULT_POINTS} pts if correct</span>
            )}
          </div>
        </div>
      )}

      {/* Exact score betting */}
      {isOpen && !userScoreBet && !userBet && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="mb-1 text-lg font-bold">Predict Exact Score</h3>
          <p className="text-silver text-sm">
            Place your winner prediction first to unlock score betting.
          </p>
        </div>
      )}

      {isOpen && !userScoreBet && userBet && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="mb-1 text-lg font-bold">Predict Exact Score</h3>
          <p className="text-silver mb-4 text-sm">
            Nail the exact score for +{EXACT_SCORE_POINTS} bonus points.
          </p>
          <ScoreBetForm
            match={match}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            memberId={member.id}
            onBetPlaced={() => window.location.reload()}
            prediction={userBet.prediction}
          />
        </div>
      )}

      {userScoreBet && (
        <div
          className={`rounded-xl p-6 ${
            userScoreBet.resolved
              ? userScoreBet.points_won > 0
                ? "bg-success/10 border-success/30 border"
                : "bg-danger/10 border-danger/30 border"
              : "bg-accent/10 border-accent/30 border"
          }`}
        >
          <h3 className="mb-2 font-bold">Your Score Prediction</h3>
          <div className="flex items-center justify-between">
            <span className="font-mono">
              {homeTeam?.tla || "Home"} {userScoreBet.predicted_home}–{userScoreBet.predicted_away}{" "}
              {awayTeam?.tla || "Away"}
            </span>
            {userScoreBet.resolved ? (
              <span
                className={`font-bold ${userScoreBet.points_won > 0 ? "text-success" : "text-danger"}`}
              >
                {userScoreBet.points_won > 0 ? `+${userScoreBet.points_won} pts` : "Miss"}
              </span>
            ) : (
              <span className="text-accent text-sm">+{EXACT_SCORE_POINTS} pts if exact</span>
            )}
          </div>
        </div>
      )}

      {/* Pick distribution */}
      {totalPicks > 0 && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="mb-3 text-lg font-bold">Predictions</h3>
          <div className="space-y-2">
            {[
              { label: homeTeam?.tla || "Home", pred: "HOME" as Prediction },
              { label: awayTeam?.tla || "Away", pred: "AWAY" as Prediction },
              ...(showDraw ? [{ label: "Draw", pred: "DRAW" as Prediction }] : []),
            ].map(({ label, pred }) => {
              const count = pickCounts[pred];
              const pct = Math.round((count / totalPicks) * 100);
              return (
                <div key={pred} className="flex items-center gap-3">
                  <span className="text-silver w-16 text-sm">{label}</span>
                  <div className="bg-background h-4 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-accent h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold">{pct}%</span>
                  <span className="text-silver w-8 text-right text-xs">{count}</span>
                </div>
              );
            })}
            <p className="text-silver mt-2 text-sm">
              {totalPicks} prediction{totalPicks !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Individual bets */}
      {allBets.length > 0 && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="mb-3 text-lg font-bold">All Predictions</h3>
          <div className="space-y-2">
            {allBets.map((bet) => {
              const canFade = isOpen && !userBet && bet.prediction !== "DRAW";
              const opposite: Prediction | null =
                bet.prediction === "HOME" ? "AWAY" : bet.prediction === "AWAY" ? "HOME" : null;
              return (
                <div
                  key={bet.id}
                  className="border-card-hover flex items-center justify-between border-b py-1.5 text-sm last:border-0"
                >
                  <span className="font-medium">{bet.member.display_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-silver">
                      {bet.prediction === "HOME"
                        ? homeTeam?.tla
                        : bet.prediction === "AWAY"
                          ? awayTeam?.tla
                          : "Draw"}
                    </span>
                    {bet.resolved && (
                      <span className={bet.points_won > 0 ? "text-success" : "text-danger"}>
                        {bet.points_won > 0 ? `+${bet.points_won}` : "Miss"}
                      </span>
                    )}
                    {canFade && opposite && (
                      <button
                        onClick={() => {
                          setFadePrediction(opposite);
                          setFadeKey((k) => k + 1);
                          betFormRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }}
                        className="text-silver hover:text-accent ml-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/5"
                        title={`Fade ${bet.member.display_name} — bet ${opposite}`}
                      >
                        Fade
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score predictions (visible after match finished or if user placed one) */}
      {allScoreBets.length > 0 && (isFinished || userScoreBet) && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="mb-3 text-lg font-bold">Score Predictions</h3>
          <div className="space-y-2">
            {allScoreBets.map((bet) => (
              <div
                key={bet.id}
                className="border-card-hover flex items-center justify-between border-b py-1.5 text-sm last:border-0"
              >
                <span className="font-medium">{bet.member.display_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-silver font-mono">
                    {bet.predicted_home}–{bet.predicted_away}
                  </span>
                  {bet.resolved && (
                    <span className={bet.points_won > 0 ? "text-success font-bold" : "text-danger"}>
                      {bet.points_won > 0 ? `+${bet.points_won} pts` : "Miss"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
