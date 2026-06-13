import { Prediction } from "./types";

interface BetForResolution {
  id: string;
  member_id: string;
  prediction: Prediction;
  gems_wagered: number;
}

interface PayoutResult {
  bet_id: string;
  member_id: string;
  gems_won: number;
}

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
 * Calculate parimutuel payouts for a finished match within a single workspace.
 *
 * Rules:
 * - Pool all wagers by prediction
 * - Winners split total pool proportional to their wager
 * - Nobody bet on correct outcome → all wagers lost (gems_won = 0)
 * - Only one outcome had bets and it won → everyone gets wager back
 */
export function calculatePayouts(bets: BetForResolution[], winner: Prediction): PayoutResult[] {
  if (bets.length === 0) return [];

  const pools: Record<Prediction, number> = { HOME: 0, AWAY: 0, DRAW: 0 };
  for (const bet of bets) {
    pools[bet.prediction] += bet.gems_wagered;
  }

  const totalPool = pools.HOME + pools.AWAY + pools.DRAW;
  const winningPool = pools[winner];

  return bets.map((bet) => {
    let gems_won = 0;

    if (bet.prediction === winner && winningPool > 0) {
      // Check if only winners bet (single-outcome scenario)
      if (winningPool === totalPool) {
        // Everyone gets their wager back
        gems_won = bet.gems_wagered;
      } else {
        gems_won = Math.floor((bet.gems_wagered / winningPool) * totalPool);
      }
    }

    return {
      bet_id: bet.id,
      member_id: bet.member_id,
      gems_won,
    };
  });
}

/**
 * Calculate implied parimutuel multipliers from pool data.
 * Multiplier = totalPool / outcomePool (e.g., 300 total, 100 on HOME → 3.0x)
 */
export function calculateOdds(
  pools: Record<Prediction, number>
): Record<Prediction, number | null> {
  const total = pools.HOME + pools.AWAY + pools.DRAW;

  if (total === 0) {
    return { HOME: null, AWAY: null, DRAW: null };
  }

  return {
    HOME: pools.HOME > 0 ? total / pools.HOME : null,
    AWAY: pools.AWAY > 0 ? total / pools.AWAY : null,
    DRAW: pools.DRAW > 0 ? total / pools.DRAW : null,
  };
}

/**
 * Calculate implied crowd probabilities from pool data.
 * Probability = outcomePool / totalPool (expressed as whole-number %)
 */
export function calculateProbabilities(
  pools: Record<Prediction, number>
): Record<Prediction, number | null> {
  const total = pools.HOME + pools.AWAY + pools.DRAW;
  if (total === 0) return { HOME: null, AWAY: null, DRAW: null };
  return {
    HOME: Math.round((pools.HOME / total) * 100),
    AWAY: Math.round((pools.AWAY / total) * 100),
    DRAW: Math.round((pools.DRAW / total) * 100),
  };
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
