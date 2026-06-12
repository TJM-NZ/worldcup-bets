# World Cup Bets 2026

Office World Cup betting webapp. Virtual gems, parimutuel payouts, multi-tenant workspaces.

## Stack

Next.js 16 (App Router, standalone) | Supabase (Postgres, email/password auth, realtime, RLS) | Tailwind CSS | Vercel (hosting + cron)

## Key Files

| Path                                         | Purpose                                 |
| -------------------------------------------- | --------------------------------------- |
| `supabase/migrations/001_initial_schema.sql` | All tables, RLS, functions              |
| `src/lib/sync.ts`                            | football-data.org sync + bet resolution |
| `src/lib/betting.ts`                         | Payout calculation, validation          |
| `src/app/api/sync/route.ts`                  | Cron-triggered sync endpoint            |
| `vercel.json`                                | Cron config (every 60s)                 |

## Env Vars

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`

## Commands

`npm run dev` — local dev | `npm run build` — production build | `npm run typecheck` — tsc --noEmit | `npm run format` — prettier write | `npm run format:check` — prettier check

## Git Workflow

Branches: `main` (production) ← `develop` (integration) ← feature branches
Feature branches: `feat/`, `fix/`, `refactor/`, `chore/` off `develop`, merged via PR
Hotfixes: `hotfix/` off `main`, PR to `main`, sync back to `develop`

Pre-commit (Husky): lint-staged (prettier + eslint) → tsc --noEmit

## Supabase (Prod)

Project: Office Betting | Ref: `fqmsaewpayxhitlqfnar` | Region: Oceania (Sydney)
CLI linked: `supabase link --project-ref fqmsaewpayxhitlqfnar`

**Push config changes to prod:**

1. Edit `supabase/config.toml` locally
2. `supabase config push` — diffs local vs remote, prompts to apply (use `--yes` to auto-confirm)
3. Verify: re-run `supabase config push` — should report all sections "up to date"

**Push schema changes to prod:**
`supabase db push` — applies pending migrations from `supabase/migrations/`
