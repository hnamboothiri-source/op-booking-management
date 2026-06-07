# Resume here (morning hand-off)

**Last worked:** 2026-06-07 night · branch `prm-foundation` · HEAD `fdc0d99` · pushed & clean.
**PR:** https://github.com/hnamboothiri-source/op-booking-management/pull/1 (open against `main`).

---

## Where we are

The full PRM platform is **built, verified, committed, and pushed** — all 16 modules of the
master doc plus many extras. See [STATUS.md](./STATUS.md) for the complete picture.

- **Code:** 51 core unit tests pass; `npm run build` clean; ~45 routes + 4 API endpoints.
- **Supabase cloud:** project `sreedhareeyam-prm` (ref `hlsrdalygohiuicesmee`) — schema (49
  tables, 2 migrations) + seed are applied and **in sync with the code**.
- **Auth:** real bcrypt login. Demo accounts (password `Sreedhareeyam@1`):
  `admin@` · `callexec@` · `front@` · `menon@sreedhareeyam.test`.

## The ONE blocker to finish in the morning → Vercel deploy

Everything else is done. The deploy needs **two dashboard actions only the owner can do**
(full steps in [DEPLOY.md](./DEPLOY.md)):

1. **Set the Supabase DB password** on the *correct* project:
   https://supabase.com/dashboard/project/hlsrdalygohiuicesmee/settings/database
   → Reset database password → use **letters + digits only** (no `@ : / ?`).
   Sanity check it works:
   ```
   psql "postgresql://postgres.hlsrdalygohiuicesmee:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" -c "select count(*) from staff_users"
   ```
   → must return `4`. (Last night `Goshala@2026` failed auth — likely reset on the wrong project.)

2. **Import to Vercel:** vercel.com/new → repo `op-booking-management` →
   **Root Directory = `apps/web`** → add env vars and Deploy:
   | env | value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://postgres.hlsrdalygohiuicesmee:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `DIRECT_URL` | `postgresql://postgres.hlsrdalygohiuicesmee:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` |
   | `CRON_SECRET` / `BI_TOKEN` / `IVR_SECRET` | any long random strings |
   | `SHOW_DEMO_LOGINS` | `false` |

> Note: the Vercel MCP can't set env vars, so step 2 is dashboard-only. As soon as the
> password from step 1 is confirmed, I can verify the connection and walk through the import.

## To resume local dev in the morning

```bash
cd "op booking management"
# local Postgres must be running (Homebrew postgresql@16); db `prm` exists
npm run dev          # http://localhost:3000  → sign in with a demo account
npm test --workspace packages/core
```
> The dev server reads `apps/web/.env.local` (DATABASE_URL + DIRECT_URL → local Postgres).
> If it 500s with "Environment variable not found: DATABASE_URL", that file is missing —
> recreate it with the local connection string.

## If we'd rather keep building features instead of deploying

Open candidates (all small, no blockers): **PDF export** on reports · **configurable
automation-rule editor** (enable/disable rules from admin) · **patient timeline** (all
activity merged chronologically). Pattern for any new feature: pure logic + test in
`packages/core`, server action + page in `apps/web`, RBAC + audit, verify against DB, commit.
If it needs a schema change, also apply the migration to Supabase via the MCP to stay in sync.
