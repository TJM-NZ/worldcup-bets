import { FdTeam, FdMatch } from './types';

const BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': API_KEY },
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
  const data = await fetchApi<TeamsResponse>('/competitions/WC/teams');
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
  const data = await fetchApi<MatchesResponse>('/competitions/WC/matches');
  return data.matches;
}

/** Fetch standings to get group letters for teams */
export async function fetchStandings(): Promise<
  Array<{ group: string; team: { id: number } }>
> {
  const data = await fetchApi<{
    standings: Array<{
      group: string;
      table: Array<{ team: { id: number } }>;
    }>;
  }>('/competitions/WC/standings');

  const result: Array<{ group: string; team: { id: number } }> = [];
  for (const standing of data.standings) {
    for (const entry of standing.table) {
      result.push({ group: standing.group, team: entry.team });
    }
  }
  return result;
}
