"use client";

import Link from "next/link";
import { Match, Team } from "@/lib/types";
import CountdownTimer from "./CountdownTimer";

function formatKickoff(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-NZ", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function NextUpStrip({
  matches,
  teams,
  workspaceSlug,
}: {
  matches: Match[];
  teams: Map<number, Team>;
  workspaceSlug: string;
}) {
  const nextMatches = matches
    .filter(
      (m) =>
        m.status === "TIMED" ||
        m.status === "SCHEDULED" ||
        m.status === "IN_PLAY" ||
        m.status === "PAUSED"
    )
    .slice(0, 3);

  if (nextMatches.length === 0) return null;

  const isLive = (m: Match) => m.status === "IN_PLAY" || m.status === "PAUSED";
  const hasLive = nextMatches.some(isLive);

  const gridClass =
    nextMatches.length === 1
      ? "grid-cols-1 max-w-sm"
      : nextMatches.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-3";

  return (
    <div className="space-y-2">
      <h2 className="text-silver text-xs font-semibold tracking-wider uppercase">
        {hasLive ? "Live & Next Up" : "Next Up"}
      </h2>
      <div className={`grid gap-3 ${gridClass}`}>
        {nextMatches.map((match) => {
          const home = match.home_team_id ? teams.get(match.home_team_id) : null;
          const away = match.away_team_id ? teams.get(match.away_team_id) : null;
          const live = isLive(match);

          return (
            <Link
              key={match.id}
              href={`/workspace/${workspaceSlug}/match/${match.id}`}
              className={`hover:bg-card-hover block rounded-xl border p-4 transition-colors ${
                live ? "border-danger/40 bg-danger/5" : "border-accent/25 bg-card"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-silver text-xs">
                  {match.group_name?.replace("GROUP_", "Group ") || match.stage.replace(/_/g, " ")}
                </span>
                {live ? (
                  <span className="bg-danger/15 text-danger animate-pulse rounded px-1.5 py-0.5 text-xs font-bold">
                    LIVE
                  </span>
                ) : (
                  <CountdownTimer targetDate={match.utc_date} />
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  {home?.crest_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={home.crest_url}
                      alt={home.tla || home.name}
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <div className="h-10 w-10" />
                  )}
                  <span className="w-full truncate text-center text-sm font-semibold">
                    {home?.tla || home?.name || "TBD"}
                  </span>
                </div>

                <div className="flex flex-col items-center px-1">
                  {live ? (
                    <span className="font-mono text-xl font-bold">
                      {match.home_score ?? 0}&nbsp;–&nbsp;{match.away_score ?? 0}
                    </span>
                  ) : (
                    <span className="text-silver text-sm">vs</span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  {away?.crest_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={away.crest_url}
                      alt={away.tla || away.name}
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <div className="h-10 w-10" />
                  )}
                  <span className="w-full truncate text-center text-sm font-semibold">
                    {away?.tla || away?.name || "TBD"}
                  </span>
                </div>
              </div>

              {!live && (
                <p className="text-silver mt-2 text-center text-xs">
                  {formatKickoff(match.utc_date)}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
