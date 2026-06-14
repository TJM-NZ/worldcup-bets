-- Migration: Replace gem wagering with fixed-points system
--
-- Points: +3 correct result, +5 exact score, +10 tournament winner pick
-- Retroactively recalculate points for already-resolved bets.
-- Cancelled/postponed match bets are deleted (no penalty, match didn't happen).

-- ============================================================
-- members: rename gems → points, reset to recalculate
-- ============================================================

ALTER TABLE public.members ADD COLUMN points integer NOT NULL DEFAULT 0;
ALTER TABLE public.members DROP COLUMN gems;

-- ============================================================
-- bets: drop gems_wagered, rename gems_won → points_won
-- ============================================================

ALTER TABLE public.bets DROP COLUMN gems_wagered;
ALTER TABLE public.bets RENAME COLUMN gems_won TO points_won;

-- Retroactively set points_won for resolved bets
UPDATE public.bets b
SET points_won = CASE
  WHEN b.prediction = CASE m.winner
    WHEN 'HOME_TEAM' THEN 'HOME'
    WHEN 'AWAY_TEAM' THEN 'AWAY'
    WHEN 'DRAW'      THEN 'DRAW'
    ELSE NULL
  END THEN 3
  ELSE 0
END
FROM public.matches m
WHERE b.match_id = m.id
  AND b.resolved = true;

-- ============================================================
-- exact_score_bets: same treatment
-- ============================================================

ALTER TABLE public.exact_score_bets DROP COLUMN gems_wagered;
ALTER TABLE public.exact_score_bets RENAME COLUMN gems_won TO points_won;

UPDATE public.exact_score_bets esb
SET points_won = CASE
  WHEN esb.predicted_home = m.home_score
   AND esb.predicted_away = m.away_score THEN 5
  ELSE 0
END
FROM public.matches m
WHERE esb.match_id = m.id
  AND esb.resolved = true;

-- ============================================================
-- winner_picks: rename gems_won → points_won
-- Existing correct picks (gems_won > 0) → 10 pts
-- ============================================================

ALTER TABLE public.winner_picks RENAME COLUMN gems_won TO points_won;

UPDATE public.winner_picks
SET points_won = CASE WHEN resolved = true AND points_won > 0 THEN 10 ELSE 0 END;

-- ============================================================
-- Recalculate member points from all resolved bets
-- ============================================================

UPDATE public.members m
SET points = (
  SELECT COALESCE(SUM(b.points_won), 0)
  FROM public.bets b
  WHERE b.member_id = m.id AND b.resolved = true
) + (
  SELECT COALESCE(SUM(esb.points_won), 0)
  FROM public.exact_score_bets esb
  WHERE esb.member_id = m.id AND esb.resolved = true
) + (
  SELECT COALESCE(SUM(wp.points_won), 0)
  FROM public.winner_picks wp
  WHERE wp.member_id = m.id AND wp.resolved = true
);

-- ============================================================
-- Replace gem functions with points equivalent
-- ============================================================

DROP FUNCTION IF EXISTS public.increment_gems(uuid, integer);
DROP FUNCTION IF EXISTS public.decrement_gems(uuid, integer);

CREATE OR REPLACE FUNCTION public.increment_points(p_member_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.members SET points = points + p_amount WHERE id = p_member_id;
END;
$$;
