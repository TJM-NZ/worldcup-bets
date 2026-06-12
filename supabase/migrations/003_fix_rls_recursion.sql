-- Fix infinite recursion in members RLS policy.
-- The "Members readable by workspace peers" policy queries members
-- to decide if you can read members, causing Postgres to error with
-- "infinite recursion detected in policy for relation members".
--
-- Solution: a security-definer function that bypasses RLS to look up
-- which workspace_ids a user belongs to.

-- Helper: returns workspace IDs for a given user (bypasses RLS)
create or replace function public.get_user_workspace_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select workspace_id from public.members where user_id = p_user_id;
$$;

-- ============================================================
-- Members policies
-- ============================================================

-- Drop the recursive policy
drop policy if exists "Members readable by workspace peers" on public.members;

-- Replace with non-recursive policy using the helper function
create policy "Members readable by workspace peers" on public.members
  for select using (
    workspace_id in (select public.get_user_workspace_ids(auth.uid()))
  );

-- ============================================================
-- Bets policies (also referenced members in a way that could recurse)
-- ============================================================

drop policy if exists "Bets readable by workspace peers" on public.bets;

create policy "Bets readable by workspace peers" on public.bets
  for select using (
    exists (
      select 1 from public.members
      where members.id = bets.member_id
        and members.workspace_id in (select public.get_user_workspace_ids(auth.uid()))
    )
  );

-- ============================================================
-- Winner picks policies (same pattern)
-- ============================================================

drop policy if exists "Winner picks readable by workspace peers" on public.winner_picks;

create policy "Winner picks readable by workspace peers" on public.winner_picks
  for select using (
    exists (
      select 1 from public.members
      where members.id = winner_picks.member_id
        and members.workspace_id in (select public.get_user_workspace_ids(auth.uid()))
    )
  );

-- ============================================================
-- Workspaces: drop redundant policy
-- "Workspaces readable by invite code" uses (true), making
-- "Workspaces readable by members" dead code. Drop the dead one.
-- ============================================================

drop policy if exists "Workspaces readable by members" on public.workspaces;
