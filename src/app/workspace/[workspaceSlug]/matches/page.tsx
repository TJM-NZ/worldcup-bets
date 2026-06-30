"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Match, Bet } from "@/lib/types";
import MatchCard from "@/components/MatchCard";
import NextUpStrip from "@/components/NextUpStrip";
import GroupStandings from "@/components/GroupStandings";

type Filter = "all" | "upcoming" | "live" | "finished" | "standings";

export default function MatchesPage() {
  const { workspace, member, teams } = useWorkspace();
  const [matches, setMatches] = useState<Match[]>([]);
  const [bets, setBets] = useState<Map<number, Bet>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .order("utc_date", { ascending: true });

      if (matchData) setMatches(matchData);
    }

    load();

    function scheduleReload() {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(load, 500);
    }

    const channel = supabase
      .channel("all-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleReload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
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

  const filtered = useMemo(
    () =>
      matches.filter((m) => {
        switch (filter) {
          case "upcoming":
            return m.status === "TIMED" || m.status === "SCHEDULED";
          case "live":
            return m.status === "IN_PLAY" || m.status === "PAUSED";
          case "finished":
            return m.status === "FINISHED";
          default:
            return true;
        }
      }),
    [matches, filter]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const key = (m.group_name || m.stage).replace(/_/g, " ");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [filtered]);

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
