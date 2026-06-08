/**
 * Build blueprint shown on the home dashboard. Mirrors docs/MODULES.md so the
 * running app always reflects the agreed scope. `phase` ties each module to the
 * roadmap; `status` tracks delivery.
 */
import type { DrillEntity } from "@prm/core";

export type BuildStatus = "done" | "in_progress" | "planned";

export interface ModuleInfo {
  id: string;
  name: string;
  phase: number;
  status: BuildStatus;
  summary: string;
  /** Module page the card links to / its drill drawer's "view full list" lands on. */
  href: string;
  /** Drill entity for the in-place preview drawer (omit for modules with no single record set). */
  drill?: DrillEntity;
}

export const MODULES: ModuleInfo[] = [
  { id: "M1", name: "Lead Management", phase: 1, status: "done", summary: "Capture, stages, sources, owners, duplicate detection, calls.", href: "/leads", drill: "leads" },
  { id: "M2", name: "Call Center", phase: 1, status: "done", summary: "Queues dashboard, call outcomes, conversion by executive.", href: "/call-center" },
  { id: "M3", name: "Appointment Management", phase: 1, status: "done", summary: "Schedules, slot generation, booking, worklist, lifecycle.", href: "/appointments", drill: "appointments" },
  { id: "M4", name: "Patient 360 Profile", phase: 1, status: "done", summary: "Search, segments, full history: bookings, leads, follow-ups, referrals, admissions, comms.", href: "/patients", drill: "patients" },
  { id: "M5", name: "Consultation Workflow", phase: 2, status: "done", summary: "Diagnosis, advice, outcome, Rx summary, lab/optometry referral, treatment plan.", href: "/consultations", drill: "consultations" },
  { id: "M6", name: "Referral Management", phase: 3, status: "done", summary: "Patient/doctor/org referrals, conversion, revenue, top referrers.", href: "/referrals", drill: "referrals" },
  { id: "M7", name: "Camp Management", phase: 3, status: "done", summary: "Camps, screening → auto-leads, conversion & revenue.", href: "/camps", drill: "camps" },
  { id: "M8", name: "Mobile Clinic", phase: 3, status: "done", summary: "Route screening → branch referral → auto-leads.", href: "/mobile-clinics", drill: "mobileClinics" },
  { id: "M9", name: "Follow-up Management", phase: 1, status: "done", summary: "Auto tasks, reminders, escalation, no drop-off.", href: "/follow-ups", drill: "followups" },
  { id: "M10", name: "Admission Conversion", phase: 2, status: "done", summary: "Recommendation funnel, counselling, packages, rejection reasons.", href: "/admissions", drill: "admissions" },
  { id: "M11", name: "Engagement & Communication", phase: 3, status: "done", summary: "WhatsApp/SMS/email, templates, bulk/campaign, consent, delivery log.", href: "/communication", drill: "communications" },
  { id: "M12", name: "Retention & Reactivation", phase: 4, status: "done", summary: "Recompute engine: categories, risk scores, reactivation tasks, success owners.", href: "/retention", drill: "retention" },
  { id: "M13", name: "Marketing Campaigns", phase: 4, status: "done", summary: "Traced ROI: cost per lead/consultation/admission, revenue, ROI%.", href: "/campaigns" },
  { id: "M14", name: "Corporate & Institutional", phase: 3, status: "done", summary: "Org profiles, contacts, camps/referrals, next-engagement.", href: "/organizations", drill: "organizations" },
  { id: "M15", name: "Task & Workflow", phase: 0, status: "done", summary: "Cross-cutting accountability engine — create, assign, transition, overdue.", href: "/tasks", drill: "tasks" },
  { id: "M16", name: "Roles & Access Control", phase: 0, status: "done", summary: "15 roles, branch-scoped RBAC, audit log, master-data CRUD.", href: "/masters" },
];

export interface PhaseInfo {
  n: number;
  name: string;
  duration: string;
}

export const PHASES: PhaseInfo[] = [
  { n: 0, name: "Foundation", duration: "~2–3 wk" },
  { n: 1, name: "MVP", duration: "8–10 wk" },
  { n: 2, name: "Consultation & Referral", duration: "8–10 wk" },
  { n: 3, name: "PRM Expansion", duration: "8–12 wk" },
  { n: 4, name: "Analytics & Dashboards", duration: "6–8 wk" },
  { n: 5, name: "Advanced (AI, mobile, HMS)", duration: "8–12 wk" },
];
