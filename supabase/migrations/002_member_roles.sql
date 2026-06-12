-- Add role column to members
alter table public.members
  add column role text not null default 'member'
  check (role in ('admin', 'member'));

-- Backfill: workspace creators become admins
update public.members m
set role = 'admin'
from public.workspaces w
where m.workspace_id = w.id
  and m.user_id = w.created_by;
