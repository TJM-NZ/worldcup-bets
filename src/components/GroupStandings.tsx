"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface StandingRow {
  group_name: string;
  position: number;
  team_id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  teams: {
    name: string;
    tla: string | null;
    crest_url: string | null;
  } | null;
}

function rowStyle(pos: number): string {
  if (pos < 2) return "bg-success/5";
  if (pos === 2) return "bg-accent/5";
  return "";
}

export default function GroupStandings() {
  const [byGroup, setByGroup] = useState<Map<string, StandingRow[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("group_standings")
      .select("*, teams(name, tla, crest_url)")
      .order("group_name", { ascending: true })
      .order("position", { ascending: true })
      .then(({ data }) => {
        const map = new Map<string, StandingRow[]>();
        for (const row of data ?? []) {
          if (!map.has(row.group_name)) map.set(row.group_name, []);
          map.get(row.group_name)!.push(row as StandingRow);
        }
        setByGroup(map);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-silver py-8 text-center">Loading standings…</p>;
  }

  if (byGroup.size === 0) {
    return <p className="text-silver py-8 text-center">Group standings not available yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...byGroup.entries()].map(([groupName, rows]) => {
          const label = groupName.replace("GROUP_", "Group ");
          return (
            <div key={groupName} className="border-card bg-card overflow-hidden rounded-lg border">
              <div className="bg-card-hover px-3 py-2">
                <h3 className="text-sm font-semibold">{label}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-card-hover text-silver border-b text-xs">
                    <th className="w-6 px-3 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">Team</th>
                    <th className="w-6 px-1 py-1.5 text-center">P</th>
                    <th className="w-6 px-1 py-1.5 text-center">W</th>
                    <th className="w-6 px-1 py-1.5 text-center">D</th>
                    <th className="w-6 px-1 py-1.5 text-center">L</th>
                    <th className="w-8 px-1 py-1.5 text-center">GD</th>
                    <th className="text-foreground w-8 px-1 py-1.5 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.team_id}
                      className={`border-card-hover/40 border-b last:border-0 ${rowStyle(row.position - 1)}`}
                    >
                      <td className="text-silver px-3 py-2 text-xs">{row.position}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          {row.teams?.crest_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.teams.crest_url}
                              alt={row.teams.tla || row.teams.name}
                              className="h-4 w-4 object-contain"
                            />
                          )}
                          <span className="font-medium">
                            {row.teams?.tla || row.teams?.name || row.team_id}
                          </span>
                        </div>
                      </td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.played}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.won}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.drawn}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.lost}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">
                        {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                      </td>
                      <td className="px-1 py-2 text-center font-bold">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <div className="text-silver flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-success/60 inline-block h-2 w-2 rounded-full" />
          Advance to Round of 32
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-accent/60 inline-block h-2 w-2 rounded-full" />
          Best 3rd may qualify
        </span>
      </div>
    </div>
  );
}
