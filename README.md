# Sreedhareeyam PRM Platform

Patient Relationship Management for Sreedhareeyam Ayurveda Hospital — covering the full patient
lifecycle: **Lead → Appointment → Consultation → Referral/Test → Treatment/Admission → Follow-up →
Retention → Referral → Lifetime relationship**.

This repo began as an OP (outpatient) booking system and is being grown into a full PRM platform.

> **Current mode: front-end prototype.** The app runs as a fully clickable UI **with no backend**
> (in-memory mock data, role-picker login) so it boots with Postgres off. Backend is deferred. To
> demo: `npm install && npm run dev` → open http://localhost:3000 → pick a role. See
> [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Documentation

- **[Build history & changelog](docs/CHANGELOG.md)** — the prototype pivot + every feature phase (timeline, drill-down, design system, call-centre desks, Lead Management to full FRS)
- **[Project status & build doc](docs/STATUS.md)** — what's built, architecture, routes, commit history, how to run
- **[Functional spec](docs/MODULES.md)** — all 16 modules, statuses, reports, masters, integrations, automation, scoring, roles
- **[Data model notes](docs/DATA.md)** — OP scheduling core (prose) + HIS boundary
- **[Prisma schema](packages/db/prisma/schema.prisma)** — canonical data model (49 models)
- **[Deployment guide](docs/DEPLOY.md)** — Supabase + Vercel steps
- **[Sample data](docs/sample-data.json)** — representative seed records

## Tech stack

Next.js 15 (App Router, TS) · PostgreSQL + Prisma · Tailwind v4 · npm workspaces monorepo.
Messaging (WhatsApp/SMS/email) and a Flutter mobile app arrive in later phases.

## Repository layout

```
apps/web              Next.js console (UI + API)
packages/db           Prisma schema, client, seed
packages/core         Domain logic: scoring, automation rules  (unit-tested)
packages/integrations Channel adapters (WhatsApp/SMS/email, lead webhooks)
docs/                 Spec & data-model docs
docker-compose.yml    Local PostgreSQL 16
```

## Getting started (local)

```bash
cp .env.example .env             # local DB creds match docker-compose
npm install
npm run db:up                    # start local Postgres (needs Docker)
npm run db:migrate               # create schema
npm run db:seed                  # load master data + a sample lead
npm run dev                      # http://localhost:3000
```

Without Docker you can still run `npm run dev` (the dashboard renders) and
`npm test --workspace packages/core` (domain-logic tests) — only the DB-backed
features need Postgres.

## Useful commands

| Command | What |
|---------|------|
| `npm run dev` | Run the web app |
| `npm run build` | Production build |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate` | Apply migrations to local DB |
| `npm run db:seed` | Seed master data |
| `npm test --workspace packages/core` | Run domain-logic unit tests |

## Roadmap

Phase 0 Foundation → 1 MVP → 2 Consultation & Referral → 3 PRM Expansion →
4 Analytics & Dashboards → 5 Advanced (AI, mobile, HMS). See [docs/MODULES.md](docs/MODULES.md).

## License

Private — all rights reserved.
