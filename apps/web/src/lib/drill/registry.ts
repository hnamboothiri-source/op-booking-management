/**
 * Drill-down registry — the single config that makes a figure drillable. Each
 * entity declares its RBAC resource, branch-scoping, allowed filter keys, how to
 * turn those filters into a Prisma `where`, and how to preview the first rows.
 *
 * Server-only: imports `prisma`. The drill API (`/api/drill`) and the list pages
 * both read from here so a figure, its drawer preview, and the "view full list"
 * page can never disagree about what a filter means.
 *
 * Server-only by construction: it imports `prisma`, so importing it from a
 * client component would fail the build — no extra guard needed.
 */
import { prisma } from "@/lib/db";
import {
  filterToWhereValue,
  filtersToQuery,
  pickAllowedFilters,
  relativeDateRange,
  parseBool,
  type DrillEntity,
  type DrillFilters,
  type DrillRow,
  type Resource,
} from "@prm/core";

type SearchParams = Record<string, string | string[] | undefined>;

type Where = Record<string, unknown>;

export interface DrillDef {
  resource: Resource;
  branchScoped: boolean;
  filters: readonly string[];
  listPath: string;
  buildWhere(f: DrillFilters): Where;
  label(f: DrillFilters): string;
  preview(where: Where, take: number): Promise<{ rows: DrillRow[]; total: number }>;
  /** Override the default `listPath?query` "view full list" URL (e.g. point at a detail page). */
  listHref?(f: DrillFilters): string;
}

const eq = filterToWhereValue;
const humanize = (s: string) => s.replace(/_/g, " ");
const rupees = (p?: number | null) => (p == null ? "" : `₹${(p / 100).toLocaleString("en-IN")}`);
const day = (d: Date) => d.toISOString().slice(0, 10);
const bool = parseBool;
/** Midnight (UTC) of the current calendar day — for relative-date filters. */
const startOfToday = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

/** Apply the listed simple-equality keys (value → equality or { in }) onto a where. */
function simpleWhere(f: DrillFilters, keys: readonly string[]): Where {
  const w: Where = {};
  for (const k of keys) if (f[k]) w[k] = eq(f[k]);
  return w;
}

export const DRILL: Record<DrillEntity, DrillDef> = {
  leads: {
    resource: "leads",
    branchScoped: true,
    filters: ["stage", "sourceId", "campaignId", "branchId", "ownerId", "patientMrd", "callback", "unassigned"],
    listPath: "/leads",
    buildWhere: (f) => {
      const w: Where = { mergedIntoId: null, ...simpleWhere(f, ["stage", "sourceId", "campaignId", "branchId", "ownerId", "patientMrd"]) };
      // Call-centre "pending callbacks": a follow-up is due (followUpDate ≤ today) and the lead is still workable.
      if (f.callback === "pending") {
        w.followUpDate = { lte: startOfToday() };
        w.stage = { in: ["contacted", "interested", "not_reachable", "appointment_suggested"] };
      }
      // Unassigned: open leads with no owner.
      if (f.unassigned === "true") {
        w.ownerId = null;
        if (!w.stage) w.stage = { notIn: ["converted_to_patient", "lost", "not_interested"] };
      }
      return w;
    },
    label: (f) => (f.callback === "pending" ? "Pending callbacks" : f.stage ? `Leads · ${humanize(f.stage)}` : "Leads"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.lead.findMany({ where, include: { source: true }, orderBy: { createdAt: "desc" }, take }),
        prisma.lead.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((l) => ({
          title: l.contactName,
          subtitle: [humanize(l.stage), l.source?.name && humanize(l.source.name)].filter(Boolean).join(" · "),
          href: `/leads/${l.id}`,
        })),
      };
    },
  },

  appointments: {
    resource: "appointments",
    branchScoped: true,
    filters: ["date", "status", "doctorId", "departmentId", "branchId", "patientMrd", "bookedOn", "appointmentType", "source"],
    listPath: "/appointments",
    buildWhere: (f) => {
      const w = simpleWhere(f, ["status", "doctorId", "departmentId", "branchId", "patientMrd", "appointmentType", "source"]);
      if (f.date) w.appointmentDate = new Date(f.date);
      // "Booked today" counts by when the booking was made, not the appointment date.
      if (f.bookedOn === "today") w.bookedAt = { gte: startOfToday() };
      return w;
    },
    label: (f) => (f.bookedOn === "today" ? "Booked today" : f.status ? `Appointments · ${humanize(f.status)}` : "Appointments"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.opBooking.findMany({ where, include: { patient: true, doctor: true }, orderBy: { appointmentDate: "desc" }, take }),
        prisma.opBooking.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((b) => ({
          title: b.patient.name,
          subtitle: `${day(b.appointmentDate)} ${b.startTime} · ${b.doctor.name}`,
          href: `/patients/${encodeURIComponent(b.patientMrd)}`,
          badge: humanize(b.status),
        })),
      };
    },
  },

  consultations: {
    resource: "consultations",
    branchScoped: true,
    filters: ["doctorId", "outcome", "diseaseId", "branchId", "patientMrd"],
    listPath: "/consultations",
    buildWhere: (f) => simpleWhere(f, ["doctorId", "outcome", "diseaseId", "branchId", "patientMrd"]),
    label: (f) => (f.outcome ? `Consultations · ${humanize(f.outcome)}` : "Consultations"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.consultation.findMany({ where, include: { patient: true, doctor: true }, orderBy: { createdAt: "desc" }, take }),
        prisma.consultation.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((c) => ({
          title: c.patient.name,
          subtitle: `${c.doctor.name} · ${humanize(c.outcome)}`,
          href: `/consultations/${c.bookingId}`,
        })),
      };
    },
  },

  admissions: {
    resource: "admissions",
    branchScoped: false,
    filters: ["status", "doctorId", "patientMrd"],
    listPath: "/admissions",
    buildWhere: (f) => simpleWhere(f, ["status", "doctorId", "patientMrd"]),
    label: (f) => (f.status ? `Admissions · ${humanize(f.status)}` : "Admissions"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.admissionRecommendation.findMany({ where, include: { patient: true, package: true }, orderBy: { createdAt: "desc" }, take }),
        prisma.admissionRecommendation.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((a) => ({
          title: a.patient.name,
          subtitle: [a.package?.name, rupees(a.estimatedCost)].filter(Boolean).join(" · "),
          href: `/patients/${encodeURIComponent(a.patientMrd)}`,
          badge: humanize(a.status),
        })),
      };
    },
  },

  followups: {
    resource: "follow_ups",
    branchScoped: false,
    filters: ["status", "type", "ownerId", "doctorId", "patientMrd", "due"],
    listPath: "/follow-ups",
    buildWhere: (f) => {
      const w = simpleWhere(f, ["status", "type", "ownerId", "doctorId", "patientMrd"]);
      // "due" buckets the open worklist by dueDate relative to today.
      const range = f.due ? relativeDateRange(f.due, new Date()) : null;
      if (range) {
        w.dueDate = range;
        if (!f.status) w.status = { in: ["pending", "booked"] }; // only open ones are "due"
      }
      return w;
    },
    label: (f) => (f.due ? `Follow-ups · ${humanize(f.due)}` : f.status ? `Follow-ups · ${humanize(f.status)}` : "Follow-ups"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.followUp.findMany({ where, include: { patient: true }, orderBy: { dueDate: "asc" }, take }),
        prisma.followUp.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((fu) => ({
          title: fu.patient.name,
          subtitle: `${humanize(fu.type)} · due ${day(fu.dueDate)}`,
          href: `/patients/${encodeURIComponent(fu.patientMrd)}`,
          badge: humanize(fu.status),
        })),
      };
    },
  },

  tasks: {
    resource: "tasks",
    branchScoped: false,
    filters: ["status", "assigneeId", "type", "patientMrd"],
    listPath: "/tasks",
    buildWhere: (f) => simpleWhere(f, ["status", "assigneeId", "type", "patientMrd"]),
    label: (f) => (f.status ? `Tasks · ${humanize(f.status)}` : "Tasks"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.task.findMany({ where, include: { assignee: true }, orderBy: { createdAt: "desc" }, take }),
        prisma.task.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((t) => ({
          title: t.subject,
          subtitle: [humanize(t.type), t.assignee?.name].filter(Boolean).join(" · "),
          badge: humanize(t.status),
        })),
      };
    },
  },

  patients: {
    resource: "patients",
    branchScoped: false,
    filters: ["category"],
    listPath: "/patients",
    buildWhere: (f) => simpleWhere(f, ["category"]),
    label: (f) => (f.category ? `Patients · ${humanize(f.category)}` : "Patients"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.patient.findMany({ where, orderBy: { updatedAt: "desc" }, take }),
        prisma.patient.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((p) => ({
          title: p.name,
          subtitle: [p.phone, p.place].filter(Boolean).join(" · "),
          href: `/patients/${encodeURIComponent(p.mrd)}`,
        })),
      };
    },
  },

  referrals: {
    resource: "referrals",
    branchScoped: false,
    filters: ["status", "type", "patientMrd", "organizationId"],
    listPath: "/referrals",
    buildWhere: (f) => {
      const w = simpleWhere(f, ["status", "type", "organizationId"]);
      // A patient can appear as referrer or referred.
      if (f.patientMrd) w.OR = [{ referrerPatientMrd: f.patientMrd }, { referredPatientMrd: f.patientMrd }];
      return w;
    },
    label: (f) => (f.status ? `Referrals · ${humanize(f.status)}` : "Referrals"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.referral.findMany({ where, include: { referredPatient: true, referrerPatient: true }, orderBy: { createdAt: "desc" }, take }),
        prisma.referral.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          title: humanize(r.type),
          subtitle: [r.referrerPatient?.name && `from ${r.referrerPatient.name}`, r.referredPatient?.name && `→ ${r.referredPatient.name}`].filter(Boolean).join(" "),
          badge: humanize(r.status),
        })),
      };
    },
  },

  communications: {
    resource: "communication",
    branchScoped: false,
    filters: ["status", "channel", "patientMrd"],
    listPath: "/communication",
    buildWhere: (f) => simpleWhere(f, ["status", "channel", "patientMrd"]),
    label: (f) => (f.channel ? `Messages · ${humanize(f.channel)}` : "Messages"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.communicationLog.findMany({ where, orderBy: { createdAt: "desc" }, take }),
        prisma.communicationLog.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((c) => ({
          title: `${humanize(c.channel)} → ${c.toAddress}`,
          subtitle: humanize(c.status),
          href: c.patientMrd ? `/patients/${encodeURIComponent(c.patientMrd)}` : undefined,
        })),
      };
    },
  },

  waitlist: {
    resource: "appointments",
    branchScoped: false,
    filters: ["status", "departmentId", "doctorId", "patientMrd"],
    listPath: "/waitlist",
    buildWhere: (f) => simpleWhere(f, ["status", "departmentId", "doctorId", "patientMrd"]),
    label: (f) => (f.status ? `Waitlist · ${humanize(f.status)}` : "Waitlist"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.waitlistEntry.findMany({ where, include: { patient: true }, orderBy: { requestedDate: "asc" }, take }),
        prisma.waitlistEntry.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((w) => ({
          title: w.patient.name,
          subtitle: `requested ${day(w.requestedDate)}`,
          href: `/patients/${encodeURIComponent(w.patientMrd)}`,
          badge: humanize(w.status),
        })),
      };
    },
  },

  retention: {
    resource: "retention",
    branchScoped: false,
    filters: ["category"],
    listPath: "/retention",
    buildWhere: (f) => simpleWhere(f, ["category"]),
    label: (f) => (f.category ? `Retention · ${humanize(f.category)}` : "Retention"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.retentionStatus.findMany({ where, include: { patient: true }, orderBy: { lastEvaluatedAt: "desc" }, take }),
        prisma.retentionStatus.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          title: r.patient.name,
          subtitle: `${humanize(r.category)} · risk ${r.riskScore}`,
          href: `/patients/${encodeURIComponent(r.patientMrd)}`,
        })),
      };
    },
  },

  // --- Module 2 / 7 / 8 / 14 entities (no branchId on these models) ---

  calls: {
    resource: "calls",
    branchScoped: false,
    filters: ["outcome", "executiveId", "leadId", "patientMrd", "when"],
    listPath: "/calls",
    buildWhere: (f) => {
      const w = simpleWhere(f, ["outcome", "executiveId", "leadId", "patientMrd"]);
      if (f.when === "today") w.createdAt = { gte: startOfToday() };
      return w;
    },
    label: (f) => (f.outcome ? `Calls · ${humanize(f.outcome)}` : "Calls"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.callLog.findMany({ where, include: { lead: true }, orderBy: { createdAt: "desc" }, take }),
        prisma.callLog.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((c) => ({
          title: c.lead?.contactName ?? c.patientMrd ?? "Call",
          subtitle: [humanize(c.outcome), c.durationSec ? `${Math.round(c.durationSec / 60)} min` : null].filter(Boolean).join(" · "),
          href: c.leadId ? `/leads/${c.leadId}` : c.patientMrd ? `/patients/${encodeURIComponent(c.patientMrd)}` : undefined,
        })),
      };
    },
  },

  campPatients: {
    resource: "camps",
    branchScoped: false,
    filters: ["campId", "recommendedVisit"],
    listPath: "/camps",
    listHref: (f) => (f.campId ? `/camps/${f.campId}` : "/camps"),
    buildWhere: (f) => {
      const w = simpleWhere(f, ["campId"]);
      const b = f.recommendedVisit !== undefined ? bool(f.recommendedVisit) : undefined;
      if (b !== undefined) w.recommendedVisit = b;
      return w;
    },
    label: (f) => (f.recommendedVisit === "true" ? "Camp patients · recommended" : "Camp patients"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.campPatient.findMany({ where, orderBy: { createdAt: "desc" }, take }),
        prisma.campPatient.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((p) => ({
          title: p.contactName,
          subtitle: p.complaint ?? undefined,
          href: p.patientMrd ? `/patients/${encodeURIComponent(p.patientMrd)}` : undefined,
          badge: p.recommendedVisit ? "recommended" : undefined,
          badgeTone: "green" as const,
        })),
      };
    },
  },

  mobileClinicPatients: {
    resource: "mobile_clinics",
    branchScoped: false,
    filters: ["mobileClinicId", "referredToBranch"],
    listPath: "/mobile-clinics",
    listHref: (f) => (f.mobileClinicId ? `/mobile-clinics/${f.mobileClinicId}` : "/mobile-clinics"),
    buildWhere: (f) => {
      const w = simpleWhere(f, ["mobileClinicId"]);
      const b = f.referredToBranch !== undefined ? bool(f.referredToBranch) : undefined;
      if (b !== undefined) w.referredToBranch = b;
      return w;
    },
    label: (f) => (f.referredToBranch === "true" ? "Mobile-clinic patients · referred" : "Mobile-clinic patients"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.mobileClinicPatient.findMany({ where, orderBy: { createdAt: "desc" }, take }),
        prisma.mobileClinicPatient.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((p) => ({
          title: p.contactName,
          subtitle: p.complaint ?? undefined,
          href: p.patientMrd ? `/patients/${encodeURIComponent(p.patientMrd)}` : undefined,
          badge: p.referredToBranch ? "referred" : undefined,
          badgeTone: "green" as const,
        })),
      };
    },
  },

  camps: {
    resource: "camps",
    branchScoped: false,
    filters: ["status", "organizerId"],
    listPath: "/camps",
    buildWhere: (f) => simpleWhere(f, ["status", "organizerId"]),
    label: (f) => (f.status ? `Camps · ${humanize(f.status)}` : "Camps"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.camp.findMany({ where, orderBy: { createdAt: "desc" }, take }),
        prisma.camp.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((c) => ({
          title: c.name,
          subtitle: c.location ?? undefined,
          href: `/camps/${c.id}`,
          badge: humanize(c.status),
        })),
      };
    },
  },

  mobileClinics: {
    resource: "mobile_clinics",
    branchScoped: false,
    filters: ["status"],
    listPath: "/mobile-clinics",
    buildWhere: (f) => simpleWhere(f, ["status"]),
    label: (f) => (f.status ? `Mobile clinics · ${humanize(f.status)}` : "Mobile clinics"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.mobileClinic.findMany({ where, orderBy: { createdAt: "desc" }, take }),
        prisma.mobileClinic.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((m) => ({
          title: m.routeName,
          subtitle: m.location ?? undefined,
          href: `/mobile-clinics/${m.id}`,
          badge: humanize(m.status),
        })),
      };
    },
  },

  organizations: {
    resource: "organizations",
    branchScoped: false,
    filters: ["type"],
    listPath: "/organizations",
    buildWhere: (f) => simpleWhere(f, ["type"]),
    label: (f) => (f.type ? `Organizations · ${humanize(f.type)}` : "Organizations"),
    preview: async (where, take) => {
      const [rows, total] = await Promise.all([
        prisma.organization.findMany({ where, orderBy: { name: "asc" }, take }),
        prisma.organization.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((o) => ({
          title: o.name,
          subtitle: humanize(o.type),
          href: `/organizations/${o.id}`,
        })),
      };
    },
  },
};

/** Build the filtered list-page URL for an entity (used as the "view all" link). */
export function drillListHref(entity: DrillEntity, filters: DrillFilters): string {
  const def = DRILL[entity];
  if (def.listHref) return def.listHref(filters);
  const q = filtersToQuery(filters);
  return q ? `${def.listPath}?${q}` : def.listPath;
}

/**
 * Parse a list page's `searchParams` into the entity's allowed drill filters
 * (string values only). Lets a list page honour the same filters a figure's
 * "view full list" link sends, using the exact same `buildWhere`.
 */
export function listFilters(entity: DrillEntity, sp: SearchParams): DrillFilters {
  const flat: DrillFilters = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") flat[k] = v;
  return pickAllowedFilters(flat, DRILL[entity].filters);
}
