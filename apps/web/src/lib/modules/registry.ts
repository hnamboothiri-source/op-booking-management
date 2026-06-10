/**
 * Module dashboard registry (master doc §modules). One config drives the
 * module-first sidebar, the per-module dashboards (/modules/[slug]) and the
 * home master-grid — like the drill/masters registries elsewhere. KPI tiles +
 * workspace links are lifted from the existing dashboard overviews so there's a
 * single source of truth.
 */
import type { DrillEntity, DrillFilters, Resource, Action, FlowPhase } from "@prm/core";
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
/** One step of a module's operator flow map (start → result). */
export interface FlowStep {
  title: string;
  description?: string;
  /** References a ModuleKpi.label on THIS module → live count + drill. */
  kpiLabel?: string;
  /** Link to the page/action (matches a WorkspaceLink.href or PLAN_ACTIVITIES createHref). */
  href?: string;
  /** Button text (defaults to "Open →"). */
  actionLabel?: string;
  icon?: IconName;
  /** Optional phase grouping — planning | implementation | result. When unset, the flow renders flat (back-compat). */
  phase?: FlowPhase;
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
      { label: "OP booking board", desc: "Today's consulting doctors, capacity & who needs patients", href: "/appointments/board", resource: "appointments" },
      { label: "Appointments", desc: "Worklist of all bookings", href: "/appointments", resource: "appointments" },
      { label: "Doctor calendar", desc: "Agenda / day / week / room views", href: "/appointments/calendar", resource: "appointments" },
      { label: "Room × Day grid", desc: "Editable weekly room-slot allotment", href: "/appointments/grid", resource: "appointments" },
      { label: "Booking chart", desc: "Month / week per-doctor new vs follow-up", href: "/appointments/booking-chart", resource: "appointments" },
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
    kpis: [
      { label: "All consultations", entity: "consultations", filters: {} },
      { label: "Admissions advised", entity: "consultations", filters: { outcome: "admission_advised" } },
      { label: "Referred out", entity: "consultations", filters: { outcome: "referred_to_department" } },
    ],
    links: [
      { label: "Queue", desc: "Patients waiting to be seen", href: "/queue", resource: "consultations" },
      { label: "Consultations", desc: "Recorded consultations & outcomes", href: "/consultations", resource: "consultations" },
      { label: "Doctor dashboard", desc: "Per-doctor queue, outcomes & pending items", href: "/consultations/doctor", resource: "consultations" },
      { label: "Consultation reports", desc: "Doctor / diagnosis / outcome / referral pattern", href: "/consultations/reports", resource: "consultations" },
    ],
  },
  {
    id: "M6", slug: "referrals", name: "Referral Management", subtitle: "Source → referral → appointment → treatment → revenue (Module 6)",
    resource: "referrals", group: "Outreach", icon: "referral", match: ["/referrals"],
    headline: { label: "Referrals", entity: "referrals", filters: {} },
    kpis: [
      { label: "All referrals", entity: "referrals", filters: {} },
      { label: "Consulted", entity: "referrals", filters: { status: "consulted,admitted" } },
      { label: "Admitted", entity: "referrals", filters: { status: "admitted" } },
      { label: "Referrers", entity: "referrers", filters: {} },
    ],
    links: [
      { label: "Referrals", desc: "Referral list, conversion & top referrers", href: "/referrals", resource: "referrals" },
      { label: "Referrers", desc: "External doctors, hospitals, practitioners & partners + relationship log", href: "/referrals/referrers", resource: "referrals" },
      { label: "Referral reports", desc: "Funnel, top referrers by type & revenue by source", href: "/referrals/reports", resource: "referrals" },
    ],
  },
  {
    id: "M7", slug: "camps", name: "Camp Management", subtitle: "Plan → budget → screen → convert → ROI (Module 7)",
    resource: "camps", group: "Outreach", icon: "tent", match: ["/camps", "/outreach"],
    headline: { label: "Camps", entity: "camps", filters: {} },
    kpis: [{ label: "All camps", entity: "camps", filters: {} }],
    links: [
      { label: "Camps", desc: "Camp list, planning, budget & screening", href: "/camps", resource: "camps" },
      { label: "Outreach dashboard", desc: "Acquisition funnel, geo & staff performance", href: "/outreach", resource: "reports" },
      { label: "Outreach reports", desc: "Budget vs spend, ROI & IP admissions by branch", href: "/outreach/reports", resource: "reports" },
    ],
  },
  {
    id: "M8", slug: "mobile-clinics", name: "Mobile Clinic", subtitle: "Plan → budget → screen → refer → ROI (Module 8)",
    resource: "mobile_clinics", group: "Outreach", icon: "truck", match: ["/mobile-clinics", "/outreach"],
    headline: { label: "Routes", entity: "mobileClinics", filters: {} },
    kpis: [{ label: "All routes", entity: "mobileClinics", filters: {} }],
    links: [
      { label: "Mobile clinics", desc: "Routes, planning, budget & screening", href: "/mobile-clinics", resource: "mobile_clinics" },
      { label: "Outreach dashboard", desc: "Acquisition funnel, geo & staff performance", href: "/outreach", resource: "reports" },
      { label: "Outreach reports", desc: "Budget vs spend, ROI & branch referrals", href: "/outreach/reports", resource: "reports" },
    ],
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
    links: [
      { label: "Follow-ups", desc: "Due / overdue worklist with ageing & escalation", href: "/follow-ups", resource: "follow_ups" },
      { label: "Escalations", desc: "SLA breaches by tier — manager view", href: "/follow-ups/escalations", resource: "follow_ups" },
      { label: "Follow-up reports", desc: "Ageing, executive productivity, conversion & compliance", href: "/follow-ups/reports", resource: "follow_ups" },
    ],
  },
  {
    id: "M10", slug: "admissions", name: "Admission Conversion", subtitle: "Recommendation → counselling → admission (Module 10)",
    resource: "admissions", group: "Clinical", icon: "bed", match: ["/admissions"],
    headline: { label: "Recommended", entity: "admissions", filters: {} },
    kpis: [{ label: "All recommendations", entity: "admissions", filters: {} }],
    links: [{ label: "Admissions", desc: "Recommendation funnel & counselling", href: "/admissions", resource: "admissions" }],
  },
  {
    id: "M17", slug: "conversion", name: "Treatment Conversion", subtitle: "Consultation → Test → Treatment → Admission (Module 17)",
    resource: "reports", group: "Clinical", icon: "bed", match: ["/conversion"],
    headline: { label: "Consultations", entity: "consultations", filters: {} },
    kpis: [
      { label: "Consultations", entity: "consultations", filters: {} },
      { label: "Tests recommended", entity: "labReferrals", filters: {} },
      { label: "Treatment plans", entity: "treatmentPlans", filters: {} },
      { label: "Admissions advised", entity: "admissions", filters: {} },
    ],
    links: [
      { label: "Conversion funnel", desc: "Consultation → Test → Treatment → Admission with stage rates", href: "/conversion", resource: "reports" },
      { label: "Tests", desc: "Lab/test referrals & completion status", href: "/conversion/tests", resource: "consultations" },
      { label: "Treatments", desc: "Treatment plans & progress", href: "/conversion/treatments", resource: "consultations" },
      { label: "Admissions", desc: "Recommendation → admission funnel", href: "/admissions", resource: "admissions" },
      { label: "Follow-ups", desc: "Review / medication / missed tracking", href: "/follow-ups", resource: "follow_ups" },
    ],
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
      { label: "Dormant", entity: "retention", filters: { category: "dormant" } },
      { label: "Lost", entity: "retention", filters: { category: "lost" } },
      { label: "Reactivated", entity: "retention", filters: { category: "reactivated" } },
    ],
    links: [
      { label: "Retention", desc: "Categories, scores, reactivation & campaigns", href: "/retention", resource: "retention" },
      { label: "Worklist", desc: "Dormant worklist with filters & quick actions", href: "/retention/worklist", resource: "retention" },
      { label: "Campaigns", desc: "Typed reactivation campaigns & response funnel", href: "/retention/campaigns", resource: "retention" },
      { label: "Executives", desc: "Patient-success productivity dashboard", href: "/retention/executives", resource: "retention" },
      { label: "Reports", desc: "Retention rate, LTV breakdown, doctor-wise retention", href: "/retention/reports", resource: "retention" },
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

/** A plannable, typed activity for a module (drives the Plan page + the create gate). */
export interface PlanActivityType {
  key: string;
  label: string;
  entity?: DrillEntity; // live metric for target vs actual
  filters?: DrillFilters;
  createHref?: string; // "Do now" launch target
  draft?: boolean; // supports create-draft-from-plan
  gates?: boolean; // an APPROVED activity of this type is required to create the entity
}

/**
 * Per-module catalog of plannable activity types. Modules absent here support
 * only free-form activities. `gates: true` types enforce the approval gate on
 * the module's discretionary create.
 */
export const PLAN_ACTIVITIES: Record<string, PlanActivityType[]> = {
  leads: [
    { key: "generate_leads", label: "Lead generation", entity: "leads", filters: {}, createHref: "/leads/new", gates: true },
    { key: "call_drive", label: "Call drive", entity: "calls", filters: {}, createHref: "/call-center" },
    { key: "campaign_push", label: "Campaign push", createHref: "/campaigns" },
  ],
  "call-center": [{ key: "call_drive", label: "Call drive", entity: "calls", filters: {}, createHref: "/call-center" }],
  appointments: [
    { key: "doctor_schedule", label: "Doctor schedule / clinic", createHref: "/appointments/schedules", draft: true, gates: true },
    { key: "clinic_session", label: "Clinic session target", entity: "appointments", filters: {} },
  ],
  referrals: [{ key: "referral_drive", label: "Referral drive", entity: "referrals", filters: {}, createHref: "/referrals", gates: true }],
  camps: [
    { key: "conduct_camp", label: "Conduct a camp", entity: "camps", filters: {}, createHref: "/camps", draft: true, gates: true },
    { key: "screenings", label: "Screenings target", entity: "campPatients", filters: {} },
  ],
  "mobile-clinics": [{ key: "run_route", label: "Run a route", entity: "mobileClinics", filters: {}, createHref: "/mobile-clinics", draft: true, gates: true }],
  "follow-ups": [{ key: "followup_drive", label: "Follow-up drive", entity: "followups", filters: {}, createHref: "/follow-ups", gates: true }],
  communication: [{ key: "message_blast", label: "Message blast", entity: "communications", filters: {}, createHref: "/communication", gates: true }],
  retention: [{ key: "reactivation_drive", label: "Reactivation drive", entity: "retention", filters: {}, createHref: "/retention", gates: true }],
  campaigns: [{ key: "launch_campaign", label: "Launch campaign", createHref: "/campaigns", draft: true, gates: true }],
  organizations: [{ key: "engagement_plan", label: "Engagement plan", entity: "organizations", filters: {}, createHref: "/organizations", gates: true }],
};

export function planActivityTypes(slug: string): PlanActivityType[] {
  return PLAN_ACTIVITIES[slug] ?? [];
}
export function getPlanActivityType(slug: string, key: string): PlanActivityType | undefined {
  return planActivityTypes(slug).find((t) => t.key === key);
}
/** The gated activity-type key for a module (the one its discretionary create needs), if any. */
export function gatedActivityKey(slug: string): string | undefined {
  return planActivityTypes(slug).find((t) => t.gates)?.key;
}

/**
 * Built-in "operator flow" for every module: the ordered Start → … → Result
 * journey shown as a dashboard strip + the Guide page. Each step references an
 * existing KPI (by label, for the live count) and a link href (for the action),
 * so it stays a thin layer over the registry. Admins can override per module.
 */
export const MODULE_FLOWS: Record<string, FlowStep[]> = {
  leads: [
    // ── PLANNING ── nothing is captured until a lead-gen drive is planned & approved.
    { phase: "planning", title: "Set lead-gen targets & budget", description: "Define the monthly lead target + budget on the module plan.", href: "/modules/leads/plan", actionLabel: "Open plan", icon: "report" },
    { phase: "planning", title: "Plan outreach campaigns", description: "Area → audience → channels & reach → expected 24h leads.", href: "/campaigns", actionLabel: "Campaigns", icon: "megaphone" },
    { phase: "planning", title: "Approve the drive", description: "Maker → checker → approver. Capture stays locked until approved.", href: "/modules/leads/plan", actionLabel: "Approve", icon: "shield" },
    // ── IMPLEMENTATION ── gated on an approved drive (createLead enforces it).
    { phase: "implementation", title: "Capture leads", description: "Log enquiries with duplicate detection.", kpiLabel: "New leads", href: "/leads/new", actionLabel: "New lead", icon: "leads" },
    { phase: "implementation", title: "Triage & assign", description: "Assign incoming leads to an executive.", kpiLabel: "Unassigned", href: "/leads", actionLabel: "Open leads", icon: "queue" },
    { phase: "implementation", title: "Prioritize hot leads", description: "Work the highest-propensity leads first.", kpiLabel: "Hot leads", href: "/prioritize", actionLabel: "Prioritize", icon: "target" },
    { phase: "implementation", title: "Call the leads", description: "Work the call queue by priority.", kpiLabel: "Pending callbacks", href: "/call-center", actionLabel: "Call centre", icon: "headset" },
    { phase: "implementation", title: "Clear follow-ups", description: "Due / overdue follow-ups & callbacks.", kpiLabel: "Due follow-ups", href: "/follow-ups", actionLabel: "Follow-ups", icon: "bell" },
    // ── RESULT ──
    { phase: "result", title: "Conversions & ROI", description: "Leads booked or converted to patients, funnel & source ROI.", kpiLabel: "Converted", href: "/reports/leads", actionLabel: "Lead report", icon: "chart" },
  ],
  "call-center": [
    { title: "Start: open the console", description: "Tabbed work console + executive funnel.", href: "/call-center", actionLabel: "Console", icon: "headset" },
    { title: "Inbound at reception", description: "New enquiry & booking calls.", kpiLabel: "New leads", href: "/reception", actionLabel: "Reception", icon: "phone" },
    { title: "Work callbacks", description: "Outbound calls to acquired leads.", kpiLabel: "Pending callbacks", href: "/back-office", actionLabel: "Back office", icon: "phone" },
    { title: "Due today", description: "Review calls to consulted patients.", kpiLabel: "Due today", href: "/front-office", actionLabel: "Front office", icon: "bell" },
    { title: "Result: missed today", description: "Not-reachable calls to retry.", kpiLabel: "Missed today", href: "/calls", actionLabel: "Call log", icon: "chart" },
  ],
  appointments: [
    { title: "Start: booking board", description: "Today's doctors, capacity & who needs patients.", href: "/appointments/board", actionLabel: "Booking board", icon: "calendar" },
    { title: "Today's booked", description: "Confirmed appointments for today.", kpiLabel: "Booked", href: "/appointments", actionLabel: "Worklist", icon: "queue" },
    { title: "Arrivals", description: "Mark patients arrived at reception.", kpiLabel: "Arrived", href: "/appointments", actionLabel: "Arrivals", icon: "patients" },
    { title: "Queue & consult", description: "Token queue and waiting time.", kpiLabel: "Waiting", href: "/queue", actionLabel: "Queue", icon: "hourglass" },
    { title: "Result: completed", description: "Consultations completed today.", kpiLabel: "Completed", href: "/reports/appointments", actionLabel: "Appt report", icon: "chart" },
  ],
  patients: [
    { title: "Start: register a patient", description: "Create a patient record.", href: "/patients/new", actionLabel: "New patient", icon: "patients" },
    { title: "Search & segment", description: "Find and segment the patient base.", kpiLabel: "All patients", href: "/patients", actionLabel: "Patients", icon: "queue" },
    { title: "Result: re-engage dormant", description: "Patients gone quiet — win them back.", kpiLabel: "Dormant", href: "/patients", actionLabel: "Dormant", icon: "heart" },
  ],
  consultations: [
    { title: "Start: the queue", description: "Patients waiting to be seen.", href: "/queue", actionLabel: "Queue", icon: "hourglass" },
    { title: "Record consultation", description: "Diagnosis, advice, outcome, Rx, referrals & plan.", kpiLabel: "All consultations", href: "/consultations", actionLabel: "Consultations", icon: "stethoscope" },
    { title: "Doctor dashboard", description: "Per-doctor queue, outcomes & pending items.", href: "/consultations/doctor", actionLabel: "Doctor view", icon: "patients" },
    { title: "Result: reports", description: "Doctor / diagnosis / outcome / referral pattern.", kpiLabel: "Admissions advised", href: "/consultations/reports", actionLabel: "Reports", icon: "chart" },
  ],
  referrals: [
    { title: "Start: add a referrer", description: "Profile the doctor / hospital / practitioner / partner.", href: "/referrals/referrers", actionLabel: "Referrers", icon: "building" },
    { title: "Log a referral", description: "Record who referred which patient.", kpiLabel: "All referrals", href: "/referrals", actionLabel: "Referrals", icon: "referral" },
    { title: "Track conversion", description: "Consulted & admitted from referrals.", kpiLabel: "Consulted", href: "/referrals", actionLabel: "View", icon: "target" },
    { title: "Result: revenue & top referrers", description: "Funnel, top referrers by type & revenue by source.", kpiLabel: "Admitted", href: "/referrals/reports", actionLabel: "Reports", icon: "chart" },
  ],
  camps: [
    { title: "Start: plan a camp", description: "Venue, budget & expected admissions.", href: "/camps", actionLabel: "Camps", icon: "tent" },
    { title: "Run & screen", description: "Active and planned camps + screenings.", kpiLabel: "All camps", href: "/camps", actionLabel: "Open", icon: "stethoscope" },
    { title: "Result: funnel & ROI", description: "Screened → admitted → revenue, by camp/location/staff.", href: "/outreach", actionLabel: "Outreach dashboard", icon: "chart" },
  ],
  "mobile-clinics": [
    { title: "Start: plan a route", description: "Route, budget & screening plan.", href: "/mobile-clinics", actionLabel: "Mobile clinics", icon: "truck" },
    { title: "Run & screen", description: "Active and planned routes.", kpiLabel: "All routes", href: "/mobile-clinics", actionLabel: "Open", icon: "stethoscope" },
    { title: "Result: funnel & ROI", description: "Screened → admitted → revenue, by route/location/staff.", href: "/outreach", actionLabel: "Outreach dashboard", icon: "chart" },
  ],
  "follow-ups": [
    { title: "Start: due today", description: "Work today's follow-up worklist.", kpiLabel: "Due today", href: "/follow-ups", actionLabel: "Follow-ups", icon: "bell" },
    { title: "Record outcomes", description: "Contact, outcome, reschedule or close.", kpiLabel: "Pending", href: "/follow-ups", actionLabel: "Worklist", icon: "headset" },
    { title: "Escalate overdue", description: "SLA tiers → manager dashboard.", kpiLabel: "Overdue", href: "/follow-ups/escalations", actionLabel: "Escalations", icon: "hourglass" },
    { title: "Result: reports", description: "Productivity, conversion & compliance.", href: "/follow-ups/reports", actionLabel: "Reports", icon: "chart" },
  ],
  admissions: [
    { title: "Start: recommendations", description: "Admission recommendations to counsel.", kpiLabel: "All recommendations", href: "/admissions", actionLabel: "Admissions", icon: "bed" },
    { title: "Result: admission", description: "Recommendation → counselling → admission.", href: "/admissions", actionLabel: "Funnel", icon: "chart" },
  ],
  conversion: [
    { title: "Start: consultations", description: "Consultations done.", kpiLabel: "Consultations", href: "/conversion", actionLabel: "Funnel", icon: "stethoscope" },
    { title: "Tests advised", description: "Lab/test referrals & completion.", kpiLabel: "Tests recommended", href: "/conversion/tests", actionLabel: "Tests", icon: "chart" },
    { title: "Treatment plans", description: "Plans & progress.", kpiLabel: "Treatment plans", href: "/conversion/treatments", actionLabel: "Treatments", icon: "heart" },
    { title: "Result: admissions", description: "Admissions advised.", kpiLabel: "Admissions advised", href: "/admissions", actionLabel: "Admissions", icon: "bed" },
  ],
  communication: [
    { title: "Start: compose a message", description: "WhatsApp / SMS / email to patients.", href: "/communication", actionLabel: "Messaging", icon: "message" },
    { title: "Result: delivery log", description: "Templates, channels & delivery.", kpiLabel: "All messages", href: "/communication", actionLabel: "Log", icon: "chart" },
  ],
  retention: [
    { title: "Start: at-risk patients", description: "Categories & risk/wellness scores.", kpiLabel: "At risk", href: "/retention", actionLabel: "Retention", icon: "heart" },
    { title: "Work the dormant list", description: "Filter & assign owners; quick-contact.", href: "/retention/worklist", actionLabel: "Worklist", icon: "patients" },
    { title: "Launch campaign", description: "Typed reactivation programs by channel.", href: "/retention/campaigns", actionLabel: "Campaigns", icon: "target" },
    { title: "Log attempts", description: "Record reactivation outreach outcomes.", href: "/retention/executives", actionLabel: "Executives", icon: "phone" },
    { title: "Result: reactivated", description: "Win-backs, LTV breakdown & doctor retention.", kpiLabel: "Reactivated", href: "/retention/reports", actionLabel: "Reports", icon: "chart" },
  ],
  campaigns: [
    { title: "Start: plan & launch", description: "Area → audience → channels → 24h leads.", href: "/campaigns", actionLabel: "Campaigns", icon: "megaphone" },
    { title: "Set channel rates", description: "Marketing-channel master & offers.", href: "/masters/marketing-channels", actionLabel: "Channel rates", icon: "sliders" },
    { title: "Result: ROI", description: "Campaign ROI & lead funnel.", href: "/reports/leads", actionLabel: "Lead report", icon: "chart" },
  ],
  organizations: [
    { title: "Start: add an organization", description: "Org profile & contacts.", href: "/organizations", actionLabel: "Organizations", icon: "building" },
    { title: "Result: engagement", description: "Camps & referrals per org.", kpiLabel: "All organizations", href: "/organizations", actionLabel: "View", icon: "chart" },
  ],
  tasks: [
    { title: "Start: open tasks", description: "Create, assign & transition tasks.", kpiLabel: "All tasks", href: "/tasks", actionLabel: "Tasks", icon: "tasks" },
    { title: "Result: clear escalations", description: "Escalated & overdue tasks.", kpiLabel: "Escalated", href: "/tasks", actionLabel: "Escalated", icon: "chart" },
  ],
  masters: [
    { title: "Start: master data", description: "20+ master datasets with generic CRUD.", href: "/masters", actionLabel: "Master data", icon: "sliders" },
    { title: "Module access by role", description: "Which department/role sees which module.", href: "/module-access", actionLabel: "Access", icon: "shield" },
    { title: "Result: audit", description: "Who changed what, when.", href: "/audit", actionLabel: "Audit log", icon: "report" },
  ],
};

/** Icons an admin may pick for a flow step (curated subset of the NavIcon union). */
export const FLOW_ICONS: IconName[] = [
  "leads", "headset", "phone", "target", "calendar", "hourglass", "queue", "stethoscope",
  "bed", "patients", "bell", "referral", "tent", "truck", "message", "building", "megaphone",
  "heart", "tasks", "chart", "report", "sliders", "shield",
];

/** Resolve the ModuleKpi a flow step references (by label), if any. */
export function flowStepKpi(def: ModuleDef, step: FlowStep): ModuleKpi | undefined {
  return step.kpiLabel ? def.kpis.find((k) => k.label === step.kpiLabel) : undefined;
}

/** Hrefs an admin may point a flow step at (this module's links + plan-activity create targets). */
export function moduleFlowHrefs(slug: string): { href: string; label: string }[] {
  const def = getModuleBySlug(slug);
  if (!def) return [];
  const out = def.links.map((l) => ({ href: l.href, label: l.label }));
  for (const a of planActivityTypes(slug)) if (a.createHref && !out.some((o) => o.href === a.createHref)) out.push({ href: a.createHref, label: a.label });
  // The module's own Plan page is always a valid flow target (used by planning-phase steps).
  const planHref = `/modules/${slug}/plan`;
  if (!out.some((o) => o.href === planHref)) out.push({ href: planHref, label: "Plan & approve" });
  return out;
}
