# World Cup Bets 2026

Office World Cup betting webapp. Virtual gems, parimutuel payouts, multi-tenant workspaces.

## Stack

Next.js 16 (App Router, standalone) | Supabase (Postgres, anon auth, realtime, RLS) | Tailwind CSS | Vercel (hosting + cron)

## Key Files

| Path | Purpose |
|------|---------|
| `supabase/migrations/001_initial_schema.sql` | All tables, RLS, functions |
| `src/lib/sync.ts` | football-data.org sync + bet resolution |
| `src/lib/betting.ts` | Payout calculation, validation |
| `src/app/api/sync/route.ts` | Cron-triggered sync endpoint |
| `vercel.json` | Cron config (every 60s) |

## Env Vars

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`

## Commands

`npm run dev` — local dev | `npm run build` — production build
