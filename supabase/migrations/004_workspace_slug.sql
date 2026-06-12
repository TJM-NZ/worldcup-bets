-- Add human-readable slug column to workspaces
ALTER TABLE public.workspaces ADD COLUMN slug text;

-- Backfill existing workspaces: lowercase name, replace non-alphanumeric with hyphens, trim hyphens
UPDATE public.workspaces
SET slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')));

ALTER TABLE public.workspaces ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX idx_workspaces_slug ON public.workspaces(slug);
