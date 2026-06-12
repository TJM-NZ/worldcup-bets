"use client";

import Link from "next/link";
import { Match, Team } from "@/lib/types";
import CountdownTimer from "./CountdownTimer";
import { isBettingOpen } from "@/lib/betting";

interface MatchCardProps {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  workspaceId: string;
  userBet?: {
    prediction: string;
    gems_wagered: number;
    gems_won: number;
    resolved: boolean;
  } | null;
}

function TeamDisplay({
  team,
  score,
  isWinner,
}: {
  team: Team | null;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${isWinner ? "font-bold" : ""}`}>
      {team?.crest_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.crest_url} alt={team.tla || team.name} className="h-6 w-6 object-contain" />
      )}
      <span className="truncate">{team?.tla || team?.name || "TBD"}</span>
      {score !== null && <span className="ml-auto font-mono text-lg">{score}</span>}
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "TIMED":
    case "SCHEDULED":
      return "";
    case "IN_PLAY":
      return "LIVE";
    case "PAUSED":
      return "HT";
    case "FINISHED":
      return "FT";
    case "POSTPONED":
      return "PPD";
    case "CANCELLED":
      return "CAN";
    default:
      return status;
  }
}

export default function MatchCard({
  match,
  homeTeam,
  awayTeam,
  workspaceId,
  userBet,
}: MatchCardProps) {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const isOpen = isBettingOpen(match.status) && new Date(match.utc_date) > new Date();

  const homeWinner = match.winner === "HOME_TEAM";
  const awayWinner = match.winner === "AWAY_TEAM";

  return (
    <Link
      href={`/workspace/${workspaceId}/match/${match.id}`}
      className={`hover:bg-card-hover block rounded-lg border p-4 transition-colors ${
        isLive ? "border-danger bg-card animate-pulse" : "border-card bg-card"
      }`}
    >
      <div className="text-silver mb-2 flex items-center justify-between text-xs">
        <span>{match.group_name || match.stage.replace(/_/g, " ")}</span>
        {isLive && <span className="text-danger font-bold">{statusLabel(match.status)}</span>}
        {isFinished && <span className="text-silver">{statusLabel(match.status)}</span>}
        {isOpen && <CountdownTimer targetDate={match.utc_date} />}
      </div>

      <div className="space-y-1">
        <TeamDisplay team={homeTeam} score={match.home_score} isWinner={homeWinner} />
        <TeamDisplay team={awayTeam} score={match.away_score} isWinner={awayWinner} />
      </div>

      {userBet && (
        <div
          className={`mt-2 rounded px-2 py-1 text-xs ${
            userBet.resolved
              ? userBet.gems_won > 0
                ? "bg-success/20 text-success"
                : "bg-danger/20 text-danger"
              : "bg-accent/20 text-accent"
          }`}
        >
          Your bet: {userBet.prediction} ({userBet.gems_wagered} gems)
          {userBet.resolved && (userBet.gems_won > 0 ? ` → Won ${userBet.gems_won}` : " → Lost")}
        </div>
      )}
    </Link>
  );
}
