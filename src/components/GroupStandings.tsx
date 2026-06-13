"use client";

import { Match, Team } from "@/lib/types";

interface TeamStanding {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

function buildStandings(matches: Match[], teams: Map<number, Team>): Map<string, TeamStanding[]> {
  // Seed groups from team.group_letter
  const standingsMap = new Map<string, Map<number, TeamStanding>>();
  for (const team of teams.values()) {
    if (!team.group_letter) continue;
    const key = `GROUP_${team.group_letter}`;
    if (!standingsMap.has(key)) standingsMap.set(key, new Map());
    standingsMap.get(key)!.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  // Accumulate results from finished group-stage matches
  for (const m of matches) {
    if (
      m.status !== "FINISHED" ||
      !m.group_name ||
      m.home_score === null ||
      m.away_score === null ||
      !m.home_team_id ||
      !m.away_team_id
    )
      continue;

    const group = standingsMap.get(m.group_name);
    if (!group) continue;

    const home = group.get(m.home_team_id);
    const away = group.get(m.away_team_id);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.gf += m.home_score;
    home.ga += m.away_score;
    away.gf += m.away_score;
    away.ga += m.home_score;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    const winner =
      m.winner ??
      (m.home_score > m.away_score
        ? "HOME_TEAM"
        : m.away_score > m.home_score
          ? "AWAY_TEAM"
          : "DRAW");

    if (winner === "HOME_TEAM") {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (winner === "AWAY_TEAM") {
      away.won++;
      away.points += 3;
      home.lost++;
    } else if (winner === "DRAW") {
      home.drawn++;
      home.points++;
      away.drawn++;
      away.points++;
    }
  }

  // Sort each group: Pts → GD → GF → name
  const result = new Map<string, TeamStanding[]>();
  for (const [key, teamMap] of standingsMap) {
    const sorted = [...teamMap.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.name.localeCompare(b.team.name);
    });
    result.set(key, sorted);
  }

  return new Map([...result.entries()].sort());
}

function rowStyle(pos: number): string {
  if (pos < 2) return "bg-success/5";
  if (pos === 2) return "bg-accent/5";
  return "";
}

export default function GroupStandings({
  matches,
  teams,
}: {
  matches: Match[];
  teams: Map<number, Team>;
}) {
  const standings = buildStandings(matches, teams);

  if (standings.size === 0) {
    return <p className="text-silver py-8 text-center">Group standings not available yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...standings.entries()].map(([key, rows]) => {
          const label = key.replace("GROUP_", "Group ");
          return (
            <div key={key} className="border-card bg-card overflow-hidden rounded-lg border">
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
                  {rows.map((row, i) => (
                    <tr
                      key={row.team.id}
                      className={`border-card-hover/40 border-b last:border-0 ${rowStyle(i)}`}
                    >
                      <td className="text-silver px-3 py-2 text-xs">{i + 1}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          {row.team.crest_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.team.crest_url}
                              alt={row.team.tla || row.team.name}
                              className="h-4 w-4 object-contain"
                            />
                          )}
                          <span className="font-medium">{row.team.tla || row.team.name}</span>
                        </div>
                      </td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.played}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.won}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.drawn}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">{row.lost}</td>
                      <td className="text-silver px-1 py-2 text-center text-xs">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
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
