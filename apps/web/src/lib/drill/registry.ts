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
}

const eq = filterToWhereValue;
const humanize = (s: string) => s.replace(/_/g, " ");
const rupees = (p?: number | null) => (p == null ? "" : `₹${(p / 100).toLocaleString("en-IN")}`);
const day = (d: Date) => d.toISOString().slice(0, 10);

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
    filters: ["stage", "sourceId", "campaignId", "branchId", "ownerId", "patientMrd"],
    listPath: "/leads",
    buildWhere: (f) => ({ mergedIntoId: null, ...simpleWhere(f, ["stage", "sourceId", "campaignId", "branchId", "ownerId", "patientMrd"]) }),
    label: (f) => (f.stage ? `Leads · ${humanize(f.stage)}` : "Leads"),
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
    filters: ["date", "status", "doctorId", "departmentId", "branchId", "patientMrd"],
    listPath: "/appointments",
    buildWhere: (f) => {
      const w = simpleWhere(f, ["status", "doctorId", "departmentId", "branchId", "patientMrd"]);
      if (f.date) w.appointmentDate = new Date(f.date);
      return w;
    },
    label: (f) => (f.status ? `Appointments · ${humanize(f.status)}` : "Appointments"),
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
    filters: ["status", "type", "ownerId", "doctorId", "patientMrd"],
    listPath: "/follow-ups",
    buildWhere: (f) => simpleWhere(f, ["status", "type", "ownerId", "doctorId", "patientMrd"]),
    label: (f) => (f.status ? `Follow-ups · ${humanize(f.status)}` : "Follow-ups"),
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
    filters: ["status", "type", "patientMrd"],
    listPath: "/referrals",
    buildWhere: (f) => {
      const w = simpleWhere(f, ["status", "type"]);
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
};

/** Build the filtered list-page URL for an entity (used as the "view all" link). */
export function drillListHref(entity: DrillEntity, filters: DrillFilters): string {
  const def = DRILL[entity];
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
