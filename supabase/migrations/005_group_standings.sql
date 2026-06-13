create table public.group_standings (
  group_name text not null,       -- e.g. 'GROUP_A'
  position integer not null,
  team_id integer not null references public.teams(id),
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  goal_difference integer not null default 0,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_name, team_id)
);

alter table public.group_standings enable row level security;

create policy "Group standings readable by all" on public.group_standings
  for select using (true);
