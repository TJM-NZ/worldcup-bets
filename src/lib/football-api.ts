import { FdTeam, FdMatch } from "./types";

const BASE_URL = "https://api.football-data.org/v4";
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": API_KEY },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org ${res.status}: ${text}`);
  }

  return res.json();
}

interface TeamsResponse {
  teams: Array<{
    id: number;
    name: string;
    tla: string;
    crest: string;
  }>;
  // The teams endpoint nests group info under competition.groups or at top level
  // We'll also fetch from the matches endpoint for group info
}

interface MatchesResponse {
  matches: FdMatch[];
}

/** Fetch all 48 teams in the World Cup */
export async function fetchTeams(): Promise<FdTeam[]> {
  const data = await fetchApi<TeamsResponse>("/competitions/WC/teams");
  return data.teams.map((t) => ({
    id: t.id,
    name: t.name,
    tla: t.tla,
    crest: t.crest,
    group: null, // group info comes from matches/standings
  }));
}

/** Fetch all World Cup matches */
export async function fetchMatches(): Promise<FdMatch[]> {
  const data = await fetchApi<MatchesResponse>("/competitions/WC/matches");
  return data.matches;
}

export interface FdStandingEntry {
  group: string;
  position: number;
  team: { id: number };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/** Fetch standings — returns full row data for all groups */
export async function fetchStandings(): Promise<FdStandingEntry[]> {
  const data = await fetchApi<{
    standings: Array<{
      group: string;
      type: string;
      table: Array<{
        position: number;
        team: { id: number };
        playedGames: number;
        won: number;
        draw: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        goalDifference: number;
        points: number;
      }>;
    }>;
  }>("/competitions/WC/standings");

  const result: FdStandingEntry[] = [];
  for (const standing of data.standings) {
    if (standing.type !== "TOTAL") continue;
    for (const entry of standing.table) {
      result.push({
        group: standing.group,
        position: entry.position,
        team: entry.team,
        playedGames: entry.playedGames,
        won: entry.won,
        draw: entry.draw,
        lost: entry.lost,
        goalsFor: entry.goalsFor,
        goalsAgainst: entry.goalsAgainst,
        goalDifference: entry.goalDifference,
        points: entry.points,
      });
    }
  }
  return result;
}
