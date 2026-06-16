-- Add AI player flags to members.
-- AI members live in a dedicated "AI Players" workspace but is_global=true
-- makes them appear in every workspace's leaderboard query.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Members: also expose is_global members to all authenticated users
DROP POLICY IF EXISTS "Members readable by workspace peers" ON public.members;
CREATE POLICY "Members readable by workspace peers or global" ON public.members
  FOR SELECT USING (
    is_global = true
    OR workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  );

-- Bets: also expose bets placed by global (AI) members
DROP POLICY IF EXISTS "Bets readable by workspace peers" ON public.bets;
CREATE POLICY "Bets readable by workspace peers or global" ON public.bets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.id = bets.member_id
        AND (
          members.is_global = true
          OR members.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
        )
    )
  );

-- exact_score_bets: replace the join-based policy; use helper fn + global support
DROP POLICY IF EXISTS "workspace members can read exact score bets" ON public.exact_score_bets;
CREATE POLICY "workspace members can read exact score bets" ON public.exact_score_bets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.id = exact_score_bets.member_id
        AND (
          members.is_global = true
          OR members.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
        )
    )
  );
