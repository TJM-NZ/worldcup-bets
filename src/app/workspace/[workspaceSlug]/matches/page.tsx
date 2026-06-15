"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Match, Team, Bet } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import NextUpStrip from "@/components/NextUpStrip";
import GroupStandings from "@/components/GroupStandings";
import { isInferredFinished, isInferredLive } from "@/lib/betting";

type Filter = "all" | "upcoming" | "live" | "finished" | "standings";

export default function MatchesPage() {
  const { workspace, member } = useWorkspace();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<number, Team>>(new Map());
  const [bets, setBets] = useState<Map<number, Bet>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .order("utc_date", { ascending: true });

      if (matchData) setMatches(matchData);

      const { data: teamData } = await supabase.from("teams").select("*");
      if (teamData) {
        const map = new Map<number, Team>();
        teamData.forEach((t) => map.set(t.id, t));
        setTeams(map);
      }
    }

    load();

    const channel = supabase
      .channel("all-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const filtered = matches.filter((m) => {
    switch (filter) {
      case "upcoming":
        return (
          (m.status === "TIMED" || m.status === "SCHEDULED") &&
          !isInferredLive(m.status, m.utc_date)
        );
      case "live":
        return (
          (m.status === "IN_PLAY" ||
            m.status === "PAUSED" ||
            isInferredLive(m.status, m.utc_date)) &&
          !isInferredFinished(m.status, m.utc_date, m.stage)
        );
      case "finished":
        return m.status === "FINISHED" || isInferredFinished(m.status, m.utc_date, m.stage);
      default:
        return true;
    }
  });

  // Group by stage (only used for match list views)
  const grouped = new Map<string, Match[]>();
  for (const m of filtered) {
    const key = (m.group_name || m.stage).replace(/_/g, " ");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  const showNextUp = filter === "all" || filter === "upcoming" || filter === "live";

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "upcoming", label: "Upcoming" },
    { value: "live", label: "Live" },
    { value: "finished", label: "Finished" },
    { value: "standings", label: "Standings" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                filter === f.value
                  ? "bg-accent/20 text-accent font-semibold"
                  : "text-silver hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filter === "standings" ? (
        <GroupStandings />
      ) : (
        <>
          {showNextUp && (
            <NextUpStrip matches={matches} teams={teams} workspaceSlug={workspace.slug} />
          )}

          {[...grouped.entries()].map(([stage, stageMatches]) => (
            <section key={stage}>
              <h2 className="text-silver mb-2 text-lg font-semibold">{stage}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {stageMatches.map((m) => (
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
          ))}

          {filtered.length === 0 && (
            <p className="text-silver py-8 text-center">No matches found</p>
          )}
        </>
      )}
    </div>
  );
}
