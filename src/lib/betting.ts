import { Prediction } from "./types";

export const RESULT_POINTS = 3;
export const EXACT_SCORE_POINTS = 5;
export const WINNER_PICK_POINTS = 10;

/**
 * Map football-data.org winner values to our prediction format.
 * API returns: HOME_TEAM, AWAY_TEAM, DRAW
 * Our bets use: HOME, AWAY, DRAW
 */
export function winnerToPrediction(winner: string): Prediction | null {
  switch (winner) {
    case "HOME_TEAM":
      return "HOME";
    case "AWAY_TEAM":
      return "AWAY";
    case "DRAW":
      return "DRAW";
    default:
      return null;
  }
}

/**
 * Check if a match is still open for betting.
 * Bets lock when status changes from TIMED/SCHEDULED.
 */
export function isBettingOpen(status: string): boolean {
  return status === "TIMED" || status === "SCHEDULED";
}

/**
 * Check if DRAW option should be available.
 * Only available in group stage.
 */
export function isDrawAvailable(stage: string): boolean {
  return stage === "GROUP_STAGE";
}

/** True for matches that have kicked off but the API hasn't flipped to IN_PLAY yet (free tier lag). */
export function isInferredLive(status: string, utcDate: string): boolean {
  if (status !== "TIMED" && status !== "SCHEDULED") return false;
  const kickoff = new Date(utcDate).getTime();
  const now = Date.now();
  return kickoff <= now && now - kickoff <= 120 * 60 * 1000;
}

/** True when the API is stuck on IN_PLAY/PAUSED but the match must have ended (free tier lag). */
export function isInferredFinished(status: string, utcDate: string, stage: string): boolean {
  if (status !== "IN_PLAY" && status !== "PAUSED") return false;
  const kickoff = new Date(utcDate).getTime();
  // Group stage: no extra time, ~110 min max. Knockout: extra time + penalties, ~160 min max.
  const maxMinutes = stage === "GROUP_STAGE" ? 110 : 160;
  return Date.now() - kickoff > maxMinutes * 60 * 1000;
}
