# Build history & changelog

A phase-by-phase record of what has been built on top of the original 16-module PRM foundation.
The earlier foundation work (M1–M16, OP scheduling, RBAC, automation engine, deployment scaffolding)
is documented in **[STATUS.md](./STATUS.md)** and **[MODULES.md](./MODULES.md)**. This file tracks the
feature phases delivered since, including the **front-end prototype pivot**.

> **Current direction — front-end prototype.** The app now runs as a **fully clickable UI with no
> backend** (no Postgres, no real auth): every page renders from in-memory fixtures, forms feel live
> but persist only in memory, and login is a one-click role picker. Real backend work (live DB,
> server-side mutations, automation engine, cron, API ingestion) is **deferred until after the
> prototype**. The seam is a single flag — `USE_REAL_DB` in `@/lib/db` — so the real Prisma client
> swaps back in for the later backend phase with no page changes.

Branch: `prm-foundation`. Stack: Next.js 15 (App Router, RSC + Server Actions) · Prisma 6 · Tailwind v4
· Recharts · npm workspaces. Domain logic lives in `packages/core` as pure, unit-tested functions.

---

## Patient timeline (`43b6036`, `c6fb640`)

Frontend-first patient activity timeline with per-kind icons, search, collapsible day groups, and
full dark-mode + responsive support. Core logic (`buildPatientTimeline`) is pure and unit-tested.

## Drill-down system — Phases 1–5 (`9ff01bb`, `c9ad72a`)

A **configurable drill-down system**: clicking any figure/count opens an in-place slide-over preview
drawer (first rows behind the number) plus a "View full list →" link to the filtered list page.

- **Central registry** `apps/web/src/lib/drill/registry.ts` — a `DRILL` map of `entity → DrillDef`
  (resource, branchScoped, allow-listed filters, `buildWhere`, `preview`, `listPath`/`listHref`).
  ~17 entities (leads, appointments, consultations, admissions, followups, tasks, patients,
  referrals, communications, waitlist, retention, calls, camps, mobile-clinics, organizations, …).
- **API** `GET /api/drill` re-checks RBAC + branch scope server-side; filters validated against the
  def's allow-list. **Client** `DrillProvider` (one mounted drawer) + `DrillStat` (KPI tiles) +
  `DrillCount` (inline cells).
- **Richer filters**: `relativeDateRange` (today/overdue/upcoming), `parseBool`, `unassigned`,
  `callback`, `bookedOn` — pure helpers in `packages/core/src/drill.ts` (unit-tested).
- Wired across dashboard KPIs, analytics, reports, list-page summary cards, and patient-detail
  sections; new `/consultations` and `/calls` list pages added.

## Design system — sidebar shell + wine/gold (`3abdde6`, `ef5e87c`)

Re-skinned the whole console to match a sibling "Accommodation Management" app for future
integration:

- **Left icon sidebar** (grouped, RBAC-filtered, `usePathname` active state, mobile drawer) + **top
  bar** (date · user · role · sign-out) — `components/shell/AppShell.tsx` + `NavIcon.tsx`.
- **Deep-wine `#7d2e46` + gold `#c0892e`** palette over a warm-cream background, done by re-pointing
  the Tailwind `rose-*` ramp to a wine ramp in `globals.css` (`@theme`) — near-zero per-file churn —
  plus a new `gold-*` ramp. Light + dark.
- **KPI cards** with a wine→gold gradient top accent; data-driven nav config so new modules drop in
  as entries.

## Automation — patient notifications + SLA escalation (`f581927`)

- The follow-up-advised and admission-recommended rules now **message the patient** (`send_message`,
  WhatsApp) in addition to creating the internal task.
- The daily cron (`/api/cron/daily`) fires `lead_uncontacted_sla_breached` for stale uncontacted
  leads — **idempotent** (skips already-escalated leads). Regression-guarded in `automation.test.ts`.

---

## Phase 8 — Front-end-only mock prototype (`2f083c8`, `6c2696f`)

Converted the full-stack app to run **with Postgres off**, via a clean reversible seam:

- **Mock dataset** `apps/web/src/lib/mock/dataset.ts` — in-memory arrays for every model, richly
  seeded, pinned to `globalThis.__PRM_MOCK__` so writes survive across requests / dev HMR.
- **Mock Prisma client** `apps/web/src/lib/mock/client.ts` — a lenient query interpreter (where
  equality + `in/lt/lte/gt/gte/not/contains`, `orderBy`, `take`, `count`, `groupBy`, `aggregate`,
  `create/update/upsert/delete`, numeric operators, relation hydration). Unknown clauses are ignored
  so no query throws. Typed `as unknown as PrismaClient` — existing call sites compile unchanged.
- **The seam**: `@/lib/db` exports the mock by default; `USE_REAL_DB` selects the real client.
- **Mock auth**: `getCurrentUser()` reads a `prm_role` cookie; login is a **one-click role picker**.
  RBAC (`@prm/core`) still drives nav + guards, so role behaviour is demoable.
- Built the missing **flow detail screens** (patient edit, consultation view, admission/appointment/
  follow-up detail, lead→patient convert, referral/task detail) so the whole journey is walkable.

## Phase 9 — Unified Call-Center work console (`8245813`)

A single tabbed work console at `/call-center`: **New Leads · Pending Calls · Today's Follow-ups ·
Overdue · Appointments · My Performance**, with inline row actions (log call, not-reachable, close
with reason, done/missed, booking transitions, escalate) reusing the existing server actions.

- **Executive funnel** `lib/callcenter/metrics.ts` — Leads → Calls → Appointments → Arrivals →
  Conversion %, live-computed.
- **Overdue ageing + escalation** pure helpers in `packages/core/src/callcenter.ts`
  (`overdueAgeDays`, `overdueBucket` 1d/2-3d/4-6d/7d+, `escalationLevel` L1–L4) — unit-tested.
- Dashboard tiles: Unassigned, Assigned-to-me, source-wise mini-breakdown (drillable via a new
  `unassigned` registry filter).

## Phase 10 — Drillable dashboard module cards (`b56a139`)

The home dashboard's 16 module cards became interactive: 13 open the drill drawer for their entity;
the 3 without a single record set (Call Center, Campaigns, Roles) navigate to their page.
`blueprint.ts` gained `href` + optional `drill`; new `ModuleCard.tsx` client component.

## Phase 11 — Call-centre desks: Reception · Front Office · Back Office (`bedd2a0`)

Modelled the call centre's three physical rooms as dedicated desks, each working its own queue, with
a stored `desk` tag (auto-set on creation, manually re-routable):

| Desk | Page | Works | Auto-tag |
|------|------|-------|----------|
| **Reception** | `/reception` | inbound enquiry & booking calls + "Log enquiry" capture | phone / walk-in |
| **Front Office** | `/front-office` | outbound review calls to consulted patients (due + overdue, ageing/escalation) | every follow-up |
| **Back Office** | `/back-office` | outbound calls to acquired leads, by-source breakdown | all other sources |

- `desk` field added to **Lead** + **FollowUp** (schema + `prisma generate`, no migration).
- Core desk config (`CALL_DESKS`, `deskForSource`, `deskForFollowUp`, `deskLabel`) + tests.
- Shared `components/callcenter/queues.tsx` (`LeadQueue`, `FollowUpQueue`, `RouteToDesk`).
- `/call-center` repurposed as an **Overview** (per-desk summary cards) + a new **Call Centre** nav group.

## Phase 12 — Lead Management to full FRS coverage (`7c063e1`, `5dc95bc`, `b517093`)

Closed the gaps against the detailed Lead Management Functional Requirement Spec (the module went
from ~65% → essentially complete). Built in three verified sub-phases.

### 12A — Capture, duplicate detection, activity timeline (`7c063e1`)
- **Lead** captures the full FRS field set: auto `leadNumber` (`LEAD-2026-000NNN`), gender, age,
  city, district, chief complaint, previous-treatment & existing-patient flags, secondary source.
- New models **LeadActivity** (unified timeline) + **LeadAssignment** (history); `leadId` on
  **CommunicationLog**; `group` on **LeadSourceMaster**.
- `/leads/new` rebuilt as a grouped **Basic / Medical / Source** client form with an inline
  **"existing record found"** dialog — Merge / Open existing / **Continue as new** — matching on
  phone / WhatsApp / email vs both leads and patients (`findDuplicates`).
- Per-lead **activity timeline** on the detail page merging activities + calls + lead-scoped
  comms + bookings, chronologically.
- Core: `nextLeadNumber`, `LEAD_ACTIVITY_KINDS` + tests.

### 12B — Assignment engine, hot/warm/cold SLA, missed calls (`5dc95bc`)
- Rule-based **auto-assignment** (`packages/core/src/assignment.ts` `routeLeadOwner`, by
  branch / disease / source-group) applied in `createLead`, with a queryable **assignment history**
  and branch-transfer support shown on the lead detail.
- **hot / warm / cold** is now the primary priority label — derived from the propensity score with a
  manual override — plus a **first-response SLA** (`slaTargetMinutes`: hot 15m · warm 2h · cold 24h;
  `slaState`: on-track / at-risk / breached). Tier + SLA badges on the leads list, detail, and
  call-centre queues (`lib/leads/tier.ts` + `components/leads/TierBadge.tsx`). The daily cron now
  escalates breached leads tier-by-tier.
- **Missed-call capture**: "Log missed call" on Reception creates a flagged lead + callback task; the
  call-centre overview shows an "uncontacted past SLA" banner.

### 12C — Funnel visualization + consolidated report (`b517093`)
- Added **Recharts**; client chart wrappers `components/charts/` (`BarChartCard`, `LeadFunnelChart`),
  styled wine/gold, with all Recharts imports kept client-side.
- **Lead conversion funnel** on the dashboard (new → contacted → interested → appointment →
  consultation → converted); segments open the drill drawer. `lib/leads/funnel.ts`.
- New **`/reports/leads`** consolidating the funnel + Leads-by-source (chart + table) + Executive
  performance + Branch performance + Campaign ROI in one drill-aware view, with CSV export.

## Phase 13 — Appointment Management to full FRS coverage (`53aaab4`, `d9b1db1`, `4181329`)

Closed the M3 gaps against the detailed Appointment FRS (book → confirm → arrive → queue → consult →
complete, across branches), in three verified sub-phases. Reused the existing 9-state machine
(`packages/core/src/booking.ts`), DoctorSchedule→TimeSlot generation, waitlist, walk-in, and the
lead→appointment→consultation wiring.

### 13A — Doctor calendar + branch dashboard + queue tokens (`53aaab4`)
- core `layoutCalendar` (column×time grid) + `nextQueueToken` + `roomConflict` + tests.
- schema: `OpBooking.queueToken/appointmentType` + reschedule/cancel reason FKs; new
  **AppointmentStatusHistory**, **AppointmentReminder**, **DoctorLeave** models; `reschedule`
  ReasonCategory; seeded slots/schedules/history.
- **`/appointments/calendar`** — custom CSS calendar: day grid (doctor / room / branch columns) +
  week view per doctor, open/booked/full/blocked tinting, book links.
- **`/appointments/branches`** — per-branch doctors-on + booked/arrived/waiting/completed/cancelled/
  no-show counts, each drillable.
- **Queue** gains token badges, waiting time (now − checkedInAt), token ordering; walk-in + arrival
  issue per-branch/day tokens.

### 13B — Reasons, status history, type, leave & conflict guards (`d9b1db1`)
- `cancelBooking` captures a ReasonMaster cancellation reason; reschedule captures a reschedule
  reason; transition/cancel/reschedule write **AppointmentStatusHistory** rows.
- Appointment detail shows Type·Room, a cancel-with-reason form, the reschedule chain, and a
  **status-history timeline**; the list gains a Type column.
- Book form: appointment-type select + **duplicate-booking warning** (active bookings for the
  patient) + reschedule-reason select.
- **Doctor leave / emergency block** (`createDoctorLeave`) blocks overlapping slots and is skipped by
  slot generation; **room-conflict guard** rejects double-booked rooms; drill `appointments` gains
  `appointmentType` + `source` filters.

### 13C — Reminders (cron) + consolidated report (`4181329`)
- core `dueReminders` (day-before for tomorrow, morning-of for today; skip already-sent) + tests.
- The daily cron now fires `appointment_upcoming` for due reminders, dispatches WhatsApp +
  `CommunicationLog`, writes `AppointmentReminder` rows, and is **idempotent** (reads reminders fresh).
- New **`/reports/appointments`** — no-show rate, slot utilisation, walk-in vs booked, doctor-wise
  (with target) + branch-wise drillable tables, and funnel / no-show-by-source charts; CSV export.
- Fix: retention recompute reads the patient referral count defensively so the mock daily cron no
  longer 500s.

---

## Verification standard

Every phase: pure helpers land in `@prm/core` with **vitest** coverage first (107 tests currently
green); then a **production build with Postgres OFF** must be clean; then a **browser walk-through**
(via the preview MCP) covering the new flows in light + dark + 375px; then commit + push.

> Known harness note: server-action submits (e.g. create-lead, duplicate dialog) bounce to `/login`
> inside the preview MCP due to a cookie/redirect quirk — verified to be a harness limitation, not a
> code bug; they work in a real browser.

## Mock-layer rule (for any schema change while in prototype mode)

1. Edit `packages/db/prisma/schema.prisma` + run `prisma generate` (no migration).
2. Seed the new model/field in `apps/web/src/lib/mock/dataset.ts`.
3. The mock client auto-creates a delegate per model; add relation hydration in `client.ts` only if a
   page reads a non-optional nested relation.
4. Confirm with a DB-off build.
