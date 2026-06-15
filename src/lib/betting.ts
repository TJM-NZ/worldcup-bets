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
