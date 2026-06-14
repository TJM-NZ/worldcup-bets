-- Migration: Add points-based scoring alongside existing gems columns
--
-- ADDITIVE ONLY — no columns are dropped, no data is deleted.
-- Backup tables snapshot the current state for rollback.
-- Old gems/wagered columns remain and can be cleaned up later once confident.
--
-- Points: +3 correct result, +5 exact score, +10 tournament winner pick

-- ============================================================
-- Snapshot current state into backup tables
-- RLS enabled with no policies = inaccessible to API clients
-- ============================================================

CREATE TABLE IF NOT EXISTS public.members_gems_backup AS
  SELECT * FROM public.members;
ALTER TABLE public.members_gems_backup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bets_gems_backup AS
  SELECT * FROM public.bets;
ALTER TABLE public.bets_gems_backup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.exact_score_bets_gems_backup AS
  SELECT * FROM public.exact_score_bets;
ALTER TABLE public.exact_score_bets_gems_backup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.winner_picks_gems_backup AS
  SELECT * FROM public.winner_picks;
ALTER TABLE public.winner_picks_gems_backup ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- members: add points column (gems kept intact)
-- ============================================================

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- ============================================================
-- bets: relax gems_wagered constraint + add points_won
-- New bets won't supply gems_wagered so NOT NULL must go
-- ============================================================

ALTER TABLE public.bets
  ALTER COLUMN gems_wagered DROP NOT NULL;

ALTER TABLE public.bets
  DROP CONSTRAINT IF EXISTS bets_gems_wagered_check;

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS points_won integer NOT NULL DEFAULT 0;

-- Backfill points_won for resolved bets
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

ALTER TABLE public.exact_score_bets
  ALTER COLUMN gems_wagered DROP NOT NULL;

ALTER TABLE public.exact_score_bets
  DROP CONSTRAINT IF EXISTS exact_score_bets_gems_wagered_check;

ALTER TABLE public.exact_score_bets
  ADD COLUMN IF NOT EXISTS points_won integer NOT NULL DEFAULT 0;

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
-- winner_picks: add points_won alongside gems_won
-- ============================================================

ALTER TABLE public.winner_picks
  ADD COLUMN IF NOT EXISTS points_won integer NOT NULL DEFAULT 0;

UPDATE public.winner_picks
SET points_won = CASE WHEN resolved = true AND gems_won > 0 THEN 10 ELSE 0 END;

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
-- Add increment_points (increment_gems / decrement_gems kept)
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_points(p_member_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.members SET points = points + p_amount WHERE id = p_member_id;
END;
$$;
