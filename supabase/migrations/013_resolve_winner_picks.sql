-- Resolve tournament winner picks once the Final is settled.
-- Idempotent: only touches unresolved picks; recomputes member points from scratch.
-- Safe to run even if the Final has not been played yet (no-op in that case).

DO $$
DECLARE
  v_champion_team_id integer;
  v_top_ai_model     text;
BEGIN
  -- Find the Final winner. Use the most-recently-played decided knockout
  -- match rather than hard-coding stage = 'FINAL' so the name mismatch
  -- (if any) can't silently block resolution.
  SELECT
    CASE winner
      WHEN 'HOME_TEAM' THEN home_team_id
      WHEN 'AWAY_TEAM' THEN away_team_id
    END
  INTO v_champion_team_id
  FROM matches
  WHERE status  = 'FINISHED'
    AND winner IN ('HOME_TEAM', 'AWAY_TEAM')
    AND stage NOT IN ('GROUP_STAGE', 'THIRD_PLACE')
  ORDER BY utc_date DESC
  LIMIT 1;

  IF v_champion_team_id IS NULL THEN
    RAISE NOTICE 'resolve_winner_picks: no decisive knockout final found — skipping';
    RETURN;
  END IF;

  -- Highest-points global AI member determines the "best AI" pick winner.
  SELECT ai_model
  INTO v_top_ai_model
  FROM members
  WHERE is_ai = true AND is_global = true AND ai_model IS NOT NULL
  ORDER BY points DESC
  LIMIT 1;

  RAISE NOTICE 'resolve_winner_picks: champion_team_id=%, top_ai=%',
    v_champion_team_id, v_top_ai_model;

  -- Mark all still-unresolved picks and compute their bonus.
  UPDATE public.winner_picks wp
  SET
    resolved   = true,
    points_won =
      CASE WHEN wp.team_id = v_champion_team_id THEN 10 ELSE 0 END
      + CASE WHEN v_top_ai_model IS NOT NULL
                  AND wp.ai_model_pick = v_top_ai_model THEN 5 ELSE 0 END
  WHERE wp.resolved = false;

  -- Recompute every member's total from all resolved sources (idempotent).
  UPDATE public.members m
  SET points =
    COALESCE((SELECT SUM(b.points_won) FROM public.bets b
              WHERE b.member_id = m.id AND b.resolved), 0)
    + COALESCE((SELECT SUM(e.points_won) FROM public.exact_score_bets e
                WHERE e.member_id = m.id AND e.resolved), 0)
    + COALESCE((SELECT SUM(w.points_won) FROM public.winner_picks w
                WHERE w.member_id = m.id AND w.resolved), 0);
END;
$$;
