-- Add AI model winner pick to winner_picks.
-- team_id made nullable so AI pick can be saved independently of team pick.

alter table public.winner_picks
  alter column team_id drop not null;

alter table public.winner_picks
  add column if not exists ai_model_pick text;

-- Allow members to update their own pick (for setting ai_model_pick)
create policy "Winner picks updatable by member" on public.winner_picks
  for update using (
    exists (
      select 1 from public.members
      where members.id = winner_picks.member_id
        and members.user_id = auth.uid()
    )
  );
