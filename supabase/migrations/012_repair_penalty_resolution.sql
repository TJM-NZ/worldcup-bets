-- One-off repair for knockout matches mis-resolved by the penalty-timing bug.
--
-- Two failure modes, same cause (bets resolved off the FINISHED status edge before
-- the shootout winner landed):
--   * 4 shootouts left stuck `resolved = false` (winner was null at the edge)
--   * Portugal–Croatia resolved with everyone at 0 (winner was transiently "DRAW")
--
-- Also fixes stored scores: football-data.org sums penalty goals into fullTime, so
-- the shootout games were stored with inflated scores (e.g. 4–5 for a real 1–1).
--
-- Safe to run on any database: all statements target specific match ids and affect
-- 0 rows where those matches don't exist. Idempotent — re-running yields the same state.

-- 1. Restore the real (pre-shootout) scoreline for the penalty games
update public.matches set home_score = 1, away_score = 1 where id = 537415; -- Germany 1–1 Paraguay (Paraguay won 4–3 pens)
update public.matches set home_score = 1, away_score = 1 where id = 537418; -- Netherlands 1–1 Morocco (Morocco won pens)
update public.matches set home_score = 1, away_score = 1 where id = 537428; -- Australia 1–1 Egypt (Egypt won pens)
update public.matches set home_score = 0, away_score = 0 where id = 537382; -- Switzerland 0–0 Colombia (Switzerland won 4–3 pens)

-- 2. (Re)resolve result bets against the true winner for all five stuck matches
update public.bets b
set resolved = true,
    points_won = case
      when b.prediction = case m.winner
        when 'HOME_TEAM' then 'HOME'
        when 'AWAY_TEAM' then 'AWAY'
        when 'DRAW'      then 'DRAW'
      end then 3
      else 0
    end
from public.matches m
where b.match_id = m.id
  and m.id in (537415, 537418, 537428, 537382, 537419);

-- 3. (Re)resolve exact-score bets against the corrected scoreline
update public.exact_score_bets e
set resolved = true,
    points_won = case
      when e.predicted_home = m.home_score and e.predicted_away = m.away_score then 5
      else 0
    end
from public.matches m
where e.match_id = m.id
  and m.id in (537415, 537418, 537428, 537382, 537419);

-- 4. Recompute every member's points total from all resolved bets (self-correcting)
update public.members mem
set points = coalesce(
      (select sum(b.points_won) from public.bets b where b.member_id = mem.id and b.resolved), 0
    ) + coalesce(
      (select sum(e.points_won) from public.exact_score_bets e where e.member_id = mem.id and e.resolved), 0
    ) + coalesce(
      (select sum(w.points_won) from public.winner_picks w where w.member_id = mem.id and w.resolved), 0
    );
