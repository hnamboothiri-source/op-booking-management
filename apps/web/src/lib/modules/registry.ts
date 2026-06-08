/**
 * Module dashboard registry (master doc §modules). One config drives the
 * module-first sidebar, the per-module dashboards (/modules/[slug]) and the
 * home master-grid — like the drill/masters registries elsewhere. KPI tiles +
 * workspace links are lifted from the existing dashboard overviews so there's a
 * single source of truth.
 */
import type { DrillEntity, DrillFilters, Resource, Action } from "@prm/core";
import type { IconName } from "@/components/shell/NavIcon";

export interface ModuleKpi {
  label: string;
  entity: DrillEntity;
  filters: DrillFilters;
}
export interface WorkspaceLink {
  label: string;
  href: string;
  desc: string;
  resource: Resource;
  action?: Action;
}
export interface ModuleDef {
  id: string; // "M1"
  slug: string; // URL key → /modules/leads
  name: string;
  subtitle: string;
  resource: Resource; // RBAC gate
  group: string; // sidebar domain group
  icon: IconName;
  match: string[]; // route prefixes the module owns → sidebar active state on sub-pages
  headline?: ModuleKpi; // single tile on the home master grid
  kpis: ModuleKpi[]; // tiles on the module dashboard
  links: WorkspaceLink[]; // workspace cards
  feature?: "leadFunnel" | "apptFlow"; // optional extra chart section
}

/** `$today` in a filter is resolved to today's ISO date at request time. */
export function resolveFilters(filters: DrillFilters): DrillFilters {
  const todayStr = new Date().toISOString().slice(0, 10);
  const out: DrillFilters = {};
  for (const [k, v] of Object.entries(filters)) out[k] = v === "$today" ? todayStr : v;
  return out;
}

const leadLinks: WorkspaceLink[] = [
  { label: "Outreach campaigns", desc: "Area → audience → channels & reach → 24h leads", href: "/campaigns", resource: "campaigns" },
  { label: "Leads", desc: "Full lead list, stages, filters & priority/SLA", href: "/leads", resource: "leads" },
  { label: "New lead", desc: "Capture an enquiry with duplicate detection", href: "/leads/new", resource: "leads", action: "create" },
  { label: "Prioritize", desc: "Hot / warm / cold work queue by propensity", href: "/prioritize", resource: "calls" },
  { label: "Call Centre", desc: "Overview of the three desks + executive funnel", href: "/call-center", resource: "calls" },
  { label: "Follow-ups", desc: "Due / overdue follow-ups with ageing", href: "/follow-ups", resource: "follow_ups" },
  { label: "Messaging", desc: "WhatsApp / SMS / email to patients", href: "/communication", resource: "communication" },
  { label: "Lead report", desc: "Funnel, source, executive, branch, campaign ROI", href: "/reports/leads", resource: "reports" },
];

export const MODULE_DASHBOARDS: ModuleDef[] = [
  {
    id: "M1", slug: "leads", name: "Lead Management", subtitle: "Capture → call → appointment → conversion (Module 1)",
    resource: "leads", group: "Engagement", icon: "leads", match: ["/leads", "/prioritize"], feature: "leadFunnel",
    headline: { label: "New leads", entity: "leads", filters: { stage: "new_lead" } },
    kpis: [
      { label: "New leads", entity: "leads", filters: { stage: "new_lead" } },
      { label: "Unassigned", entity: "leads", filters: { unassigned: "true" } },
      { label: "Pending callbacks", entity: "leads", filters: { callback: "pending" } },
      { label: "Hot leads", entity: "leads", filters: { priorityTier: "hot" } },
      { label: "Due follow-ups", entity: "followups", filters: { due: "today" } },
      { label: "Converted", entity: "leads", filters: { stage: "appointment_booked,converted_to_patient" } },
    ],
    links: leadLinks,
  },
  {
    id: "M2", slug: "call-center", name: "Call Center", subtitle: "Three desks taking calls & converting leads (Module 2)",
    resource: "calls", group: "Engagement", icon: "headset", match: ["/call-center", "/reception", "/front-office", "/back-office", "/calls"],
    headline: { label: "Pending callbacks", entity: "leads", filters: { callback: "pending" } },
    kpis: [
      { label: "New leads", entity: "leads", filters: { stage: "new_lead" } },
      { label: "Unassigned", entity: "leads", filters: { unassigned: "true" } },
      { label: "Pending callbacks", entity: "leads", filters: { callback: "pending" } },
      { label: "Due today", entity: "followups", filters: { due: "today" } },
      { label: "Missed today", entity: "calls", filters: { outcome: "not_reachable", when: "today" } },
    ],
    links: [
      { label: "Overview", desc: "Tabbed work console + executive funnel", href: "/call-center", resource: "calls" },
      { label: "Reception", desc: "Inbound enquiry & booking calls", href: "/reception", resource: "calls" },
      { label: "Front Office", desc: "Review calls to consulted patients", href: "/front-office", resource: "follow_ups" },
      { label: "Back Office", desc: "Outbound calls to acquired leads", href: "/back-office", resource: "calls" },
      { label: "Calls", desc: "Call log across leads & patients", href: "/calls", resource: "calls" },
    ],
  },
  {
    id: "M3", slug: "appointments", name: "Appointment Management", subtitle: "Book → arrive → queue → consult (Module 3)",
    resource: "appointments", group: "Clinical", icon: "calendar", match: ["/appointments", "/waitlist", "/queue"], feature: "apptFlow",
    headline: { label: "Today", entity: "appointments", filters: { date: "$today" } },
    kpis: [
      { label: "Booked", entity: "appointments", filters: { date: "$today", status: "booked,confirmed" } },
      { label: "Arrived", entity: "appointments", filters: { date: "$today", status: "arrived" } },
      { label: "Waiting", entity: "appointments", filters: { date: "$today", status: "waiting,in_consultation" } },
      { label: "Completed", entity: "appointments", filters: { date: "$today", status: "completed" } },
      { label: "No-show", entity: "appointments", filters: { date: "$today", status: "no_show" } },
    ],
    links: [
      { label: "Appointments", desc: "Worklist of all bookings", href: "/appointments", resource: "appointments" },
      { label: "Doctor calendar", desc: "Agenda / day / week / room views", href: "/appointments/calendar", resource: "appointments" },
      { label: "Branch schedule", desc: "Per-branch booked / arrived / no-show", href: "/appointments/branches", resource: "appointments" },
      { label: "Waitlist", desc: "Priority waitlist & promotion", href: "/waitlist", resource: "appointments" },
      { label: "Queue", desc: "Today's token queue & waiting time", href: "/queue", resource: "consultations" },
      { label: "Appointment report", desc: "Doctor / branch / no-show / utilisation", href: "/reports/appointments", resource: "reports" },
    ],
  },
  {
    id: "M4", slug: "patients", name: "Patient 360 Profile", subtitle: "Search, segments & full patient history (Module 4)",
    resource: "patients", group: "Clinical", icon: "patients", match: ["/patients"],
    headline: { label: "Patients", entity: "patients", filters: {} },
    kpis: [
      { label: "All patients", entity: "patients", filters: {} },
      { label: "Dormant", entity: "patients", filters: { category: "dormant" } },
    ],
    links: [
      { label: "Patients", desc: "Search & segment the patient base", href: "/patients", resource: "patients" },
      { label: "New patient", desc: "Register a patient record", href: "/patients/new", resource: "patients", action: "create" },
    ],
  },
  {
    id: "M5", slug: "consultations", name: "Consultation Workflow", subtitle: "Diagnosis, advice, outcome & treatment plan (Module 5)",
    resource: "consultations", group: "Clinical", icon: "stethoscope", match: ["/consultations"],
    headline: { label: "Consultations", entity: "consultations", filters: {} },
    kpis: [{ label: "All consultations", entity: "consultations", filters: {} }],
    links: [
      { label: "Consultations", desc: "Recorded consultations & outcomes", href: "/consultations", resource: "consultations" },
      { label: "Queue", desc: "Patients waiting to be seen", href: "/queue", resource: "consultations" },
    ],
  },
  {
    id: "M6", slug: "referrals", name: "Referral Management", subtitle: "Patient / doctor / org referrals & conversion (Module 6)",
    resource: "referrals", group: "Outreach", icon: "referral", match: ["/referrals"],
    headline: { label: "Referrals", entity: "referrals", filters: {} },
    kpis: [{ label: "All referrals", entity: "referrals", filters: {} }],
    links: [{ label: "Referrals", desc: "Referral list, conversion & top referrers", href: "/referrals", resource: "referrals" }],
  },
  {
    id: "M7", slug: "camps", name: "Camp Management", subtitle: "Camps → screening → auto-leads (Module 7)",
    resource: "camps", group: "Outreach", icon: "tent", match: ["/camps"],
    headline: { label: "Camps", entity: "camps", filters: {} },
    kpis: [{ label: "All camps", entity: "camps", filters: {} }],
    links: [{ label: "Camps", desc: "Camp list, screening & conversion", href: "/camps", resource: "camps" }],
  },
  {
    id: "M8", slug: "mobile-clinics", name: "Mobile Clinic", subtitle: "Route screening → branch referral (Module 8)",
    resource: "mobile_clinics", group: "Outreach", icon: "truck", match: ["/mobile-clinics"],
    headline: { label: "Routes", entity: "mobileClinics", filters: {} },
    kpis: [{ label: "All routes", entity: "mobileClinics", filters: {} }],
    links: [{ label: "Mobile clinics", desc: "Routes, screening & referrals", href: "/mobile-clinics", resource: "mobile_clinics" }],
  },
  {
    id: "M9", slug: "follow-ups", name: "Follow-up Management", subtitle: "Auto tasks, reminders & escalation (Module 9)",
    resource: "follow_ups", group: "Clinical", icon: "bell", match: ["/follow-ups"],
    headline: { label: "Due today", entity: "followups", filters: { due: "today" } },
    kpis: [
      { label: "Due today", entity: "followups", filters: { due: "today" } },
      { label: "Overdue", entity: "followups", filters: { due: "overdue" } },
      { label: "Pending", entity: "followups", filters: { status: "pending,booked" } },
    ],
    links: [{ label: "Follow-ups", desc: "Due / overdue with ageing & escalation", href: "/follow-ups", resource: "follow_ups" }],
  },
  {
    id: "M10", slug: "admissions", name: "Admission Conversion", subtitle: "Recommendation → counselling → admission (Module 10)",
    resource: "admissions", group: "Clinical", icon: "bed", match: ["/admissions"],
    headline: { label: "Recommended", entity: "admissions", filters: {} },
    kpis: [{ label: "All recommendations", entity: "admissions", filters: {} }],
    links: [{ label: "Admissions", desc: "Recommendation funnel & counselling", href: "/admissions", resource: "admissions" }],
  },
  {
    id: "M11", slug: "communication", name: "Engagement & Communication", subtitle: "WhatsApp / SMS / email & delivery log (Module 11)",
    resource: "communication", group: "Engagement", icon: "message", match: ["/communication"],
    headline: { label: "Messages", entity: "communications", filters: {} },
    kpis: [{ label: "All messages", entity: "communications", filters: {} }],
    links: [{ label: "Messaging", desc: "Templates, channels & delivery log", href: "/communication", resource: "communication" }],
  },
  {
    id: "M12", slug: "retention", name: "Retention & Reactivation", subtitle: "Categories, risk scores & reactivation (Module 12)",
    resource: "retention", group: "Growth", icon: "heart", match: ["/retention"],
    headline: { label: "At risk", entity: "retention", filters: { category: "at_risk" } },
    kpis: [
      { label: "At risk", entity: "retention", filters: { category: "at_risk" } },
      { label: "Lost", entity: "retention", filters: { category: "lost" } },
    ],
    links: [
      { label: "Retention", desc: "Risk categories & reactivation tasks", href: "/retention", resource: "retention" },
      { label: "Prioritize", desc: "High-risk work queue", href: "/prioritize", resource: "calls" },
    ],
  },
  {
    id: "M13", slug: "campaigns", name: "Marketing Campaigns", subtitle: "Plan → launch → 24h leads → ROI (Module 13)",
    resource: "campaigns", group: "Growth", icon: "megaphone", match: ["/campaigns"],
    kpis: [],
    links: [
      { label: "Campaigns", desc: "Plan, launch & traced ROI", href: "/campaigns", resource: "campaigns" },
      { label: "Channel rates", desc: "Marketing-channel master & seasonal offers", href: "/masters/marketing-channels", resource: "masters" },
      { label: "Lead report", desc: "Campaign ROI & lead funnel", href: "/reports/leads", resource: "reports" },
    ],
  },
  {
    id: "M14", slug: "organizations", name: "Corporate & Institutional", subtitle: "Org profiles, contacts & engagement (Module 14)",
    resource: "organizations", group: "Outreach", icon: "building", match: ["/organizations"],
    headline: { label: "Organizations", entity: "organizations", filters: {} },
    kpis: [{ label: "All organizations", entity: "organizations", filters: {} }],
    links: [{ label: "Organizations", desc: "Org profiles, camps & referrals", href: "/organizations", resource: "organizations" }],
  },
  {
    id: "M15", slug: "tasks", name: "Task & Workflow", subtitle: "Cross-cutting accountability engine (Module 15)",
    resource: "tasks", group: "Workflow", icon: "tasks", match: ["/tasks"],
    headline: { label: "Tasks", entity: "tasks", filters: {} },
    kpis: [
      { label: "All tasks", entity: "tasks", filters: {} },
      { label: "Escalated", entity: "tasks", filters: { status: "escalated" } },
    ],
    links: [{ label: "Tasks", desc: "Create, assign, transition & overdue", href: "/tasks", resource: "tasks" }],
  },
  {
    id: "M16", slug: "masters", name: "Roles & Access Control", subtitle: "Master data, roles & audit (Module 16)",
    resource: "masters", group: "Admin", icon: "sliders", match: ["/masters"],
    kpis: [],
    links: [
      { label: "Master data", desc: "20+ master datasets with generic CRUD", href: "/masters", resource: "masters" },
      { label: "Module access by role", desc: "Which department / role sees which module", href: "/module-access", resource: "masters" },
      { label: "Audit log", desc: "Who changed what, when", href: "/audit", resource: "audit" },
    ],
  },
];

export function getModuleBySlug(slug: string): ModuleDef | undefined {
  return MODULE_DASHBOARDS.find((m) => m.slug === slug);
}
