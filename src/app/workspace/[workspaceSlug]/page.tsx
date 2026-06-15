"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Match, Team, Bet } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import PointsBadge from "@/components/PointsBadge";
import { isInferredLive } from "@/lib/betting";

export default function WorkspaceDashboard() {
  const { workspace, member } = useWorkspace();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<number, Team>>(new Map());
  const [bets, setBets] = useState<Map<number, Bet>>(new Map());
  const [memberCount, setMemberCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // Load member count
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id);
      if (count !== null) setMemberCount(count);

      // Load upcoming & live matches
      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .in("status", ["TIMED", "SCHEDULED", "IN_PLAY", "PAUSED"])
        .order("utc_date", { ascending: true })
        .limit(10);

      if (matchData) setMatches(matchData);

      // Load teams
      const { data: teamData } = await supabase.from("teams").select("*");
      if (teamData) {
        const map = new Map<number, Team>();
        teamData.forEach((t) => map.set(t.id, t));
        setTeams(map);
      }
    }

    load();

    // Realtime match updates
    const channel = supabase
      .channel("dashboard-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace.id, refreshKey]);

  // Load user's bets
  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("bets")
      .select("*")
      .eq("member_id", member.id)
      .then(({ data }) => {
        if (data) {
          const map = new Map<number, Bet>();
          data.forEach((b) => map.set(b.match_id, b));
          setBets(map);
        }
      });
  }, [member.id]);

  async function handleForceSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync/force", { method: "POST" });
      setRefreshKey((k) => k + 1);
    } finally {
      setSyncing(false);
    }
  }

  const liveMatches = matches.filter(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED" || isInferredLive(m.status, m.utc_date)
  );
  const upcoming = matches.filter(
    (m) =>
      (m.status === "TIMED" || m.status === "SCHEDULED") && !isInferredLive(m.status, m.utc_date)
  );

  return (
    <div className="space-y-8">
      {/* Workspace header */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <span className="text-accent">{workspace.name}</span>
            </h1>
            <div className="text-silver mt-2 flex items-center gap-4 text-sm">
              <span>
                {memberCount} {memberCount === 1 ? "player" : "players"}
              </span>
              <span className="text-card-hover">|</span>
              <span className="flex items-center gap-1.5">
                You: <PointsBadge points={member.points} size="sm" />
              </span>
            </div>
          </div>
          <button
            onClick={handleForceSync}
            disabled={syncing}
            className="text-silver hover:text-accent disabled:text-silver/50 rounded-lg p-2 transition-colors"
            title="Force refresh match data"
          >
            <svg
              className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <section>
          <h2 className="text-danger mb-3 text-xl font-bold">Live Now</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                homeTeam={teams.get(m.home_team_id!) || null}
                awayTeam={teams.get(m.away_team_id!) || null}
                workspaceSlug={workspace.slug}
                userBet={bets.get(m.id) || null}
              />
            ))}
          </div>
        </section>
      )}

      <section data-tour="upcoming-matches">
        <h2 className="mb-3 text-xl font-bold">Upcoming Matches</h2>
        {upcoming.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                homeTeam={teams.get(m.home_team_id!) || null}
                awayTeam={teams.get(m.away_team_id!) || null}
                workspaceSlug={workspace.slug}
                userBet={bets.get(m.id) || null}
              />
            ))}
          </div>
        ) : (
          <p className="text-silver bg-card rounded-lg py-8 text-center">
            No upcoming matches. Trigger a sync to load data.
          </p>
        )}
      </section>
    </div>
  );
}
