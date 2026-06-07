# Deployment guide — Supabase + Vercel

The app is **deploy-ready**. The Supabase database is already provisioned and seeded.
Two steps remain, and both are dashboard actions (they need credentials/config that
automated tooling can't set for you).

---

## 0. What's already done

- **Supabase project** `sreedhareeyam-prm` (ref `hlsrdalygohiuicesmee`, region `ap-southeast-1`, free tier).
  - Full schema (49 tables) applied.
  - Seeded: branches, departments, 3 doctors, 15 lead sources, admission packages,
    communication templates, an organization, and **4 demo staff accounts**.
- **Demo logins** (password `Sreedhareeyam@1`): `admin@`, `callexec@`, `front@`, `menon@sreedhareeyam.test`.
- Build is configured for Vercel: `apps/web` build runs `prisma generate` (rhel target);
  daily cron declared in `apps/web/vercel.json`.

---

## 1. Set the Supabase database password

The schema/seed were applied through Supabase's admin API, which doesn't expose the DB
role password. Prisma (at runtime on Vercel) needs it. Set it once:

1. Open **https://supabase.com/dashboard/project/hlsrdalygohiuicesmee/settings/database**
   (this is the correct project — make sure the URL ref is `hlsrdalygohiuicesmee`).
2. **Database password → Reset database password.** Choose a password with **letters + digits
   only** (avoid `@ : / ? #` so no URL-encoding is needed). Save and wait for the success toast.
3. Build the two connection strings (replace `PASSWORD`):

   ```
   DATABASE_URL="postgresql://postgres.hlsrdalygohiuicesmee:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.hlsrdalygohiuicesmee:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```

   - `DATABASE_URL` = transaction pooler (6543) for serverless runtime.
   - `DIRECT_URL`  = session pooler (5432) for migrations.
   - Host is **`aws-1`**-ap-southeast-1 (confirmed for this project), user `postgres.hlsrdalygohiuicesmee`.
   - If your password contains `@`, encode it as `%40` in the URLs.

> Sanity check from any machine with `psql`:
> `psql "postgresql://postgres.hlsrdalygohiuicesmee:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" -c "select count(*) from staff_users;"`
> should return `4`.

---

## 2. Deploy on Vercel

1. **https://vercel.com/new** → import the GitHub repo **`hnamboothiri-source/op-booking-management`**.
2. **Root Directory:** `apps/web`  (click *Edit* and select it). Framework auto-detects **Next.js**.
3. Leave Build/Install commands as default — the workspace lockfile at the repo root is
   detected automatically, and `apps/web`'s build script already runs `prisma generate`.
4. **Environment Variables** (Project → Settings → Environment Variables), for Production:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the pooler URL from step 1 (6543, `?pgbouncer=true`) |
   | `DIRECT_URL` | the session URL from step 1 (5432) |
   | `CRON_SECRET` | any long random string (protects `/api/cron/daily`) |
   | `BI_TOKEN` | any long random string (protects `/api/analytics/kpis`) |
   | `SHOW_DEMO_LOGINS` | `false` (hide the demo-account hint on the login page) |

5. **Deploy.** First build runs `prisma generate` + `next build`.
6. Visit the deployment URL → `/login` → sign in with a demo account (or set `SHOW_DEMO_LOGINS`
   off and use your own staff records).

### Cron
`apps/web/vercel.json` schedules `GET /api/cron/daily` at 02:00 UTC (retention recompute +
follow-up reminder dispatch). Vercel picks this up automatically; it's authorised by `CRON_SECRET`.

### Branch deploys
The branch `prm-foundation` is the PR branch. Vercel will build preview deployments for it;
production deploys from `main` once the PR is merged.

---

## 3. After deploy — optional hardening

- Swap the console messaging driver in `packages/integrations` for live WhatsApp Business API /
  SMS gateway / email credentials (add their keys as Vercel env vars).
- Add Supabase Row-Level Security policies if any client-side Supabase access is introduced
  (currently all DB access is server-side via Prisma, guarded by app-layer RBAC).
- Rotate the demo staff passwords (or delete the demo accounts) before real use.
