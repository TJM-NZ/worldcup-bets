export interface Workspace {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  display_name: string;
  email?: string;
  points: number;
  role: "admin" | "member";
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  tla: string | null;
  crest_url: string | null;
  group_letter: string | null;
}

export interface Match {
  id: number;
  utc_date: string;
  status: MatchStatus;
  stage: string;
  group_name: string | null;
  matchday: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

export type MatchStatus =
  | "TIMED"
  | "SCHEDULED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED";

export type Prediction = "HOME" | "AWAY" | "DRAW";

export interface Bet {
  id: string;
  member_id: string;
  match_id: number;
  prediction: Prediction;
  points_won: number;
  resolved: boolean;
  created_at: string;
}

export interface ExactScoreBet {
  id: string;
  member_id: string;
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  points_won: number;
  resolved: boolean;
  created_at: string;
}

export interface WinnerPick {
  id: string;
  member_id: string;
  team_id: number;
  resolved: boolean;
  points_won: number;
  created_at: string;
}

export interface SyncLog {
  id: number;
  synced_at: string;
  matches_updated: number;
  error: string | null;
}

// football-data.org API response types
export interface FdTeam {
  id: number;
  name: string;
  tla: string;
  crest: string;
  group: string | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: { id: number | null; name: string | null };
  awayTeam: { id: number | null; name: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
    winner: string | null;
  };
}

// Enriched types for UI
export interface MatchWithTeams extends Match {
  home_team: Team | null;
  away_team: Team | null;
}

export interface BetWithMember extends Bet {
  member: Pick<Member, "id" | "display_name">;
}

export interface ExactScoreBetWithMember extends ExactScoreBet {
  member: Pick<Member, "id" | "display_name">;
}

export interface LeaderboardEntry {
  member_id: string;
  display_name: string;
  points: number;
  total_bets: number;
  wins: number;
}
