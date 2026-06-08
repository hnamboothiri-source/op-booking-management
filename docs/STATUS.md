# Project status & build documentation

> **Update — front-end prototype mode.** Since this doc was first written, the app was converted to a
> **front-end-only prototype** (mock data, role-picker login, runs with Postgres off) and several
> feature phases were added (drill-down system, sidebar/wine-gold redesign, call-centre work console
> + 3 desks, drillable module cards, Lead Management to full FRS coverage with funnel + reports).
> The narrative below describes the original DB-backed foundation; for everything built since —
> including the prototype pivot — see **[CHANGELOG.md](./CHANGELOG.md)**.

A consolidated record of what has been built for the **Sreedhareeyam Patient Relationship
Management (PRM)** platform, as of branch `prm-foundation` (PR #1).

- **Scope source:** [MODULES.md](./MODULES.md) (the 16-module functional spec derived from the
  *Master Software Development Document*).
- **Data model:** [DATA.md](./DATA.md) + the authoritative [Prisma schema](../packages/db/prisma/schema.prisma).
- **Deployment:** [DEPLOY.md](./DEPLOY.md).

**Status in one line:** all 16 modules + several extra features are implemented and verified
locally against PostgreSQL; the Supabase cloud DB is provisioned and seeded; only the Vercel
deploy remains (blocked on dashboard credentials).

---

## 1. Tech stack & architecture

| Layer | Choice |
|-------|--------|
| Frontend + backend | Next.js 15 (App Router, TypeScript, RSC + Server Actions) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL (local Homebrew for dev; Supabase for cloud) |
| ORM | Prisma 6 (pooled `DATABASE_URL` + `DIRECT_URL` for migrations) |
| Auth | bcrypt password login + httpOnly cookie session |
| Messaging | pluggable driver (`@prm/integrations`) — console driver in dev; WhatsApp/SMS/email keys swap in |
| Hosting target | Vercel (web) + Supabase (DB), daily cron via `vercel.json` |

**Monorepo (npm workspaces):**

```
apps/web                  Next.js console (UI + API)  — ~40 routes
packages/core             Pure domain logic, unit-tested (no I/O)  — 47 tests
packages/db               Prisma schema (49 models), client, seed
packages/integrations     Messaging drivers + inbound-lead normalisation
docs/                     MODULES, DATA, DEPLOY, STATUS (this file)
```

Design principle: **all business rules live in `packages/core` as pure functions** (state
machines, scoring, ordering) so they're unit-tested in isolation; the app layer wires them to
Prisma + RBAC + audit.

---

## 2. Modules — coverage

All 16 modules from the spec are **done**. Extra features added on top are noted.

| # | Module | Status | Primary routes |
|---|--------|--------|----------------|
| M1 | Lead Management | ✅ | `/leads`, `/leads/new`, `/leads/[id]` (+ transfer, merge) |
| M2 | Call Center | ✅ | `/call-center`, call logging on lead detail |
| M3 | Appointment Management | ✅ | `/appointments`, `/appointments/schedules`, `/appointments/book` (+ `/waitlist`, reschedule, `/appointments/walk-in`) |
| M4 | Patient 360 Profile | ✅ | `/patients`, `/patients/[mrd]` (+ documents, consent, segments) |
| M5 | Consultation Workflow | ✅ | `/queue`, `/consultations/[bookingId]` |
| M6 | Referral Management | ✅ | `/referrals` |
| M7 | Camp Management | ✅ | `/camps`, `/camps/[id]` |
| M8 | Mobile Clinic | ✅ | `/mobile-clinics`, `/mobile-clinics/[id]` |
| M9 | Follow-up Management | ✅ | `/follow-ups` |
| M10 | Admission Conversion | ✅ | `/admissions` |
| M11 | Engagement & Communication | ✅ | `/communication` (+ birthday / annual-checkup cron) |
| M12 | Retention & Reactivation | ✅ | `/retention` |
| M13 | Marketing Campaigns | ✅ | `/campaigns`, `/campaigns/[id]` |
| M14 | Corporate & Institutional | ✅ | `/organizations`, `/organizations/[id]` |
| M15 | Task & Workflow | ✅ | `/tasks` |
| M16 | Roles & Access Control | ✅ | enforced everywhere; `/audit`, `/masters/*` (admin) |

**Cross-cutting:** 5 dashboards (Management on `/`, `/call-center`, Doctor on `/`, branch +
marketing on `/analytics`), report library (`/reports`), 20 master-data sets (`/masters`),
KPI rollups, predictive prioritization (`/prioritize`).

**Extra features beyond the base spec:** lead transfer & merge, appointment **waitlist**
(priority→FIFO promote), appointment **reschedule** (supersede chain), **walk-in** quick
register, **room allocation** on bookings, **doctor daily-targets** (today-vs-target on
analytics), patient **documents**, **birthday / annual-checkup** automation, predictive
**lead-propensity** scoring, daily **cron**, **CSV export** on reports, and a **BI KPI** feed.

---

## 3. Route inventory

**Console (auth-gated, role-filtered nav):** `/` (dashboard) · `/leads` · `/leads/new` ·
`/leads/[id]` · `/call-center` · `/prioritize` · `/appointments` · `/appointments/book` ·
`/appointments/schedules` · `/appointments/walk-in` · `/waitlist` · `/queue` ·
`/consultations/[bookingId]` · `/admissions` · `/patients` · `/patients/new` ·
`/patients/[mrd]` · `/follow-ups` · `/referrals` · `/camps` · `/camps/[id]` ·
`/mobile-clinics` · `/mobile-clinics/[id]` · `/communication` · `/organizations` ·
`/organizations/[id]` · `/campaigns` · `/campaigns/[id]` · `/retention` · `/tasks` ·
`/analytics` · `/reports` · `/masters` · `/masters/[entity]` (+ `/new`, `/[id]`) · `/audit`.

**Public:** `/login` · `/enquiry` (website lead form) · `/forbidden`.

**API:**
- `POST /api/leads/{website|facebook|google}` — inbound lead webhooks (source + campaign
  attribution + duplicate detection).
- `GET|POST /api/cron/daily` — retention recompute + reminder/birthday/annual dispatch
  (secured by `CRON_SECRET`; scheduled in `vercel.json` at 02:00).
- `GET /api/analytics/kpis` — KPI rollups as JSON for Power BI / Metabase (secured by `BI_TOKEN`).
- `POST /api/calls/ivr` — IVR/telephony webhook: logs a call (matched to lead/patient by phone),
  stores recording, fires missed-call → callback-task automation (secured by `IVR_SECRET`).
- `GET /api/reports/export?type=…` — CSV export of report tables (auth + reports-view gated).

---

## 4. Core domain logic (`packages/core`, 47 tests)

| File | Responsibility |
|------|----------------|
| `rbac.ts` | 15-role permission matrix, `can()`, `visibleResources()`, branch scoping |
| `booking.ts` | 9-state appointment machine, slot capacity, slot-time generation |
| `admission.ts` | 8-state admission funnel, rejection-reason guard, consultation-outcome helpers |
| `tasks.ts` | task state machine + overdue derivation |
| `leads.ts` | lead stage classification + conversion rate |
| `scoring.ts` | retention + conversion scoring (explainable, ML-ready) |
| `campaign.ts` | cost-per-lead/consult/admission, ROI %, retention-risk mapping |
| `prioritization.ts` | lead-propensity score (hot/warm/cold) |
| `waitlist.ts` | priority-then-FIFO ordering |
| `automation.ts` | declarative automation-rule registry (master doc §10) |

---

## 5. Data model (49 Prisma models)

Grouped per spec: **core** (Patient, Lead, OpBooking, Consultation, Doctor, Branch, Department,
Room, StaffUser) · **PRM** (Campaign, LeadSource, Referral, FollowUp, Task, CommunicationLog,
PatientSegment, PatientScore, RetentionStatus) · **clinical coordination** (Prescription,
Diagnosis-on-consult, LabReferral, OptometryReferral, AdmissionRecommendation, TreatmentPlan) ·
**outreach** (Camp, MobileClinic, Organization, CampPatient, MobileClinicPatient) ·
**analytics rollups** (DailyKPI, BranchKPI, DoctorKPI, CampaignKPI, ExecutiveKPI) ·
**scheduling** (DoctorSchedule, TimeSlot, WaitlistEntry) · **masters** (20 sets) · **AuditLog**.

> **HIS boundary preserved:** full EMR / prescriptions-of-record / billing / pharmacy / lab
> results stay in the HIS. The PRM tracks coordination + outcomes and caches patient master.

---

## 6. Auth, RBAC & audit

- **Auth:** email + bcrypt password → httpOnly cookie session (`apps/web/src/lib/session.ts`).
- **RBAC:** every page/action calls `requireCan(resource, action)`; nav is filtered by role;
  branch-scoped roles only see their branch's rows.
- **Audit:** every mutating action writes an `AuditLog` row (actor, action, entity, before/after);
  viewable at `/audit`.

**Demo accounts** (password `Sreedhareeyam@1`): `admin@`, `callexec@`, `front@`,
`menon@sreedhareeyam.test`. (Hide the hint in prod with `SHOW_DEMO_LOGINS=false`.)

---

## 7. Automation

Driven by the `@prm/core` rule registry, executed in `apps/web/src/lib/automation.ts`:
- New website/Meta/Google enquiry → lead (+ campaign attribution + duplicate-mobile alert task).
- Appointment created → confirmation message; no-show → callback task.
- Consultation follow-up advised → task; admission recommended → counselling task.
- Missed follow-up → escalation; dormant patient → reactivation task.
- Daily cron → retention recompute, follow-up reminders, birthday wishes, annual-checkup reminders.

---

## 8. Build phases & commit history (branch `prm-foundation`)

| Commit | What |
|--------|------|
| `d2a156a` | Foundation: functional spec, data model, Prisma schema |
| `475ad3c` | Scaffold monorepo (Next.js + Prisma + local DB) |
| `2a619d2` | **Phase 0** — RBAC, 20 master CRUD, audit, task engine |
| `fee8f0a` | **Phase 1 (MVP)** — leads, call centre, appointments, patients, follow-ups |
| `db2bcc4` | **Phase 2** — consultation, admission conversion, reports |
| `a6794a3` | **Phase 3** — referrals, camps, mobile clinics, engagement, corporate, intake |
| `c0ed24f` | **Phase 4** — marketing ROI, retention, analytics (all 16 modules done) |
| `49a80a0` | **Phase 5** — predictive prioritization, daily cron, BI feed |
| `4eaa541` | Real bcrypt auth |
| `1cfb8d1`–`49f4abf` | Supabase `directUrl`, Vercel-ready build, deploy guide |
| `cbdc069` | Waitlist, reschedule, lead transfer & merge |
| `fb6c2f1` | Patient documents, engagement automation, walk-in register |

Every phase was verified end-to-end (build + unit tests + a browser/DB smoke of the key flows)
before commit.

---

## 9. Running locally

```bash
cp .env.example .env          # local Postgres creds (also create apps/web/.env.local with the same)
npm install
npm run db:up                 # local Postgres (Docker) — or use a local Postgres + create db `prm`
npm run db:migrate
npm run db:seed               # masters, doctors, demo staff (+ sample data)
npm run dev                   # http://localhost:3000  → sign in with a demo account
npm test --workspace packages/core   # 47 domain-logic tests
```

> Note: the Next dev server reads env from `apps/web/.env.local` (Next loads env from the app
> dir, not the monorepo root). Keep `DATABASE_URL` + `DIRECT_URL` there for local dev.

---

## 10. Cloud & deployment status

- **Supabase** project `sreedhareeyam-prm` (ref `hlsrdalygohiuicesmee`, ap-southeast-1, free
  tier): full schema (49 tables) + seed (masters, doctors, demo staff) **already applied**.
- **Vercel:** not yet deployed — see [DEPLOY.md](./DEPLOY.md). Two dashboard actions remain
  (set the Supabase DB password; import `apps/web` with env vars). The build is Vercel-ready
  (`prisma generate` in build, `rhel` binary target, cron in `vercel.json`).

---

## 11. What remains (optional)

- **Productionization:** finish the Vercel deploy; swap the console messaging driver for live
  WhatsApp/SMS/email credentials; rotate/remove demo accounts.
- **Phase 5 extras:** Flutter patient mobile app; HMS/EMR & payment-gateway integration;
  Power BI dashboards on the KPI feed; ML model behind the scoring interfaces.
- **Possible next features:** template-driven message composer, PDF export on reports,
  IVR/call-recording integration, configurable automation-rule editor (all small additions).
