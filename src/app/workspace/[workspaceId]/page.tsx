"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth, useMember } from "@/lib/hooks";
import { Match, Team, Bet, Workspace } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import Leaderboard from "@/components/Leaderboard";
import GemBadge from "@/components/GemBadge";

export default function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { userId } = useAuth();
  const { member } = useMember(workspaceId, userId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<number, Team>>(new Map());
  const [bets, setBets] = useState<Map<number, Bet>>(new Map());
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // Load workspace info
      const { data: wsData } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();
      if (wsData) setWorkspace(wsData);

      // Load member count
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);
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
  }, [workspaceId]);

  // Load user's bets
  useEffect(() => {
    if (!member) return;
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
  }, [member]);

  const liveMatches = matches.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
  const upcoming = matches.filter((m) => m.status === "TIMED" || m.status === "SCHEDULED");

  return (
    <div className="space-y-8">
      {/* Workspace header */}
      <div className="bg-card rounded-xl p-6">
        <h1 className="text-3xl font-bold">
          <span className="text-accent">{workspace?.name ?? "..."}</span>
        </h1>
        <div className="text-silver mt-2 flex items-center gap-4 text-sm">
          <span>
            {memberCount} {memberCount === 1 ? "player" : "players"}
          </span>
          {member && (
            <>
              <span className="text-card-hover">|</span>
              <span className="flex items-center gap-1.5">
                You: <GemBadge gems={member.gems} size="sm" />
              </span>
            </>
          )}
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
                workspaceId={workspaceId}
                userBet={bets.get(m.id) || null}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">Upcoming Matches</h2>
        {upcoming.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                homeTeam={teams.get(m.home_team_id!) || null}
                awayTeam={teams.get(m.away_team_id!) || null}
                workspaceId={workspaceId}
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

      <section>
        <h2 className="mb-3 text-xl font-bold">Leaderboard</h2>
        <Leaderboard workspaceId={workspaceId} currentMemberId={member?.id} />
      </section>
    </div>
  );
}
