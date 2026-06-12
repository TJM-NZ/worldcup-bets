-- World Cup Bets - Initial Schema
-- Run this in Supabase SQL Editor or via CLI

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Tables
-- ============================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  display_name text not null,
  gems integer not null default 1000,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.teams (
  id integer primary key, -- football-data.org team ID
  name text not null,
  tla text, -- three-letter abbreviation
  crest_url text,
  group_letter text
);

create table public.matches (
  id integer primary key, -- football-data.org match ID
  utc_date timestamptz not null,
  status text not null default 'TIMED', -- TIMED, SCHEDULED, IN_PLAY, PAUSED, FINISHED, POSTPONED, CANCELLED
  stage text not null, -- GROUP_STAGE, ROUND_OF_16, QUARTER_FINALS, SEMI_FINALS, FINAL, etc.
  group_name text, -- e.g. 'Group A'
  matchday integer,
  home_team_id integer references public.teams(id),
  away_team_id integer references public.teams(id),
  home_score integer,
  away_score integer,
  winner text -- HOME_TEAM, AWAY_TEAM, DRAW, null
);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  match_id integer not null references public.matches(id),
  prediction text not null check (prediction in ('HOME', 'AWAY', 'DRAW')),
  gems_wagered integer not null check (gems_wagered >= 10),
  gems_won integer not null default 0,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (member_id, match_id)
);

create table public.winner_picks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  team_id integer not null references public.teams(id),
  resolved boolean not null default false,
  gems_won integer not null default 0,
  created_at timestamptz not null default now(),
  unique (member_id)
);

create table public.sync_log (
  id bigint primary key generated always as identity,
  synced_at timestamptz not null default now(),
  matches_updated integer not null default 0,
  error text
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_members_workspace on public.members(workspace_id);
create index idx_members_user on public.members(user_id);
create index idx_bets_member on public.bets(member_id);
create index idx_bets_match on public.bets(match_id);
create index idx_bets_resolved on public.bets(resolved) where not resolved;
create index idx_matches_status on public.matches(status);
create index idx_matches_utc_date on public.matches(utc_date);
create index idx_workspaces_invite on public.workspaces(invite_code);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.bets enable row level security;
alter table public.winner_picks enable row level security;
alter table public.sync_log enable row level security;

-- Teams & Matches: readable by everyone (authenticated)
create policy "Teams are readable by all" on public.teams
  for select using (true);

create policy "Matches are readable by all" on public.matches
  for select using (true);

-- Workspaces: readable by members, creatable by authenticated users
create policy "Workspaces readable by members" on public.workspaces
  for select using (
    exists (
      select 1 from public.members
      where members.workspace_id = workspaces.id
        and members.user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

create policy "Workspaces creatable by authenticated" on public.workspaces
  for insert with check (auth.uid() = created_by);

-- Also allow reading workspace by invite_code (for join flow)
create policy "Workspaces readable by invite code" on public.workspaces
  for select using (true);
  -- We allow select on all workspaces; the invite flow needs to look up by code.
  -- Sensitive data isn't in this table. If you want tighter control,
  -- use a function instead.

-- Members: scoped to workspace membership
create policy "Members readable by workspace peers" on public.members
  for select using (
    exists (
      select 1 from public.members as m
      where m.workspace_id = members.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "Members insertable by self" on public.members
  for insert with check (auth.uid() = user_id);

create policy "Members updatable by self" on public.members
  for update using (auth.uid() = user_id);

-- Bets: readable by workspace peers, insertable by self
create policy "Bets readable by workspace peers" on public.bets
  for select using (
    exists (
      select 1 from public.members
      where members.id = bets.member_id
        and members.workspace_id in (
          select m2.workspace_id from public.members m2 where m2.user_id = auth.uid()
        )
    )
  );

create policy "Bets insertable by member" on public.bets
  for insert with check (
    exists (
      select 1 from public.members
      where members.id = bets.member_id
        and members.user_id = auth.uid()
    )
  );

-- Winner picks: same pattern as bets
create policy "Winner picks readable by workspace peers" on public.winner_picks
  for select using (
    exists (
      select 1 from public.members
      where members.id = winner_picks.member_id
        and members.workspace_id in (
          select m2.workspace_id from public.members m2 where m2.user_id = auth.uid()
        )
    )
  );

create policy "Winner picks insertable by member" on public.winner_picks
  for insert with check (
    exists (
      select 1 from public.members
      where members.id = winner_picks.member_id
        and members.user_id = auth.uid()
    )
  );

-- Sync log: readable by all authenticated (for debug/display)
create policy "Sync log readable" on public.sync_log
  for select using (true);

-- ============================================================
-- Functions
-- ============================================================

-- Atomic gem increment (called via service role)
create or replace function increment_gems(p_member_id uuid, p_amount integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.members
  set gems = gems + p_amount
  where id = p_member_id;
end;
$$;

-- Atomic gem decrement with balance check (called via service role)
create or replace function decrement_gems(p_member_id uuid, p_amount integer)
returns boolean
language plpgsql
security definer
as $$
declare
  rows_affected integer;
begin
  update public.members
  set gems = gems - p_amount
  where id = p_member_id
    and gems >= p_amount;
  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;
