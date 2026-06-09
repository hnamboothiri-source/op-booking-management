/**
 * Mock Prisma client for the front-end prototype (Phase 8). Backs a small
 * in-memory object graph (see dataset.ts) so the whole app runs with no
 * database. It is deliberately LENIENT: it honours the common query options the
 * app uses (where equality + in/lt/lte/gt/gte/not/contains, orderBy, take,
 * count, groupBy, aggregate, create/update/upsert/delete) and ignores anything
 * it doesn't recognise (returning the unfiltered set) so no query ever throws.
 *
 * Fixtures are denormalised by reference (a booking already carries `.patient`,
 * `.doctor`, …), so `include`/`select` are effectively no-ops — we just return
 * the rows as-is. This trades filter precision for "every page renders", which
 * is the right call for a click-through prototype. The real Prisma client
 * returns behind `USE_REAL_DB` (see @/lib/db) for the later backend phase.
 */
import { store, nextId } from "./dataset";

type Row = Record<string, any>;

// Scalar defaults applied to newly-created rows (Prisma schema defaults the real
// DB would supply) so created records render without missing required fields.
const DEFAULTS: Record<string, Row> = {
  lead: { stage: "new_lead", priority: "medium", mergedIntoId: null, missedEnquiry: false, calls: [] },
  opBooking: { status: "booked", noPreference: false, requestedDoctorId: null },
  doctor: { active: true, opDoctor: true, newTargetPct: 70, followupTargetPct: 30 },
  admissionRecommendation: { status: "recommended" },
  staffUser: { active: true, managedModules: [] },
  modulePlan: { status: "draft", plannedBudget: 0, targets: [], activities: [], budgetBreakdown: null },
  moduleMaster: { active: true, fields: [], listColumns: [] },
  customRecord: { data: {} },
  planConfig: { cadence: "quarterly", monthlyBudget: false, entryFields: [], reportColumns: [], flowSteps: [] },
  medicationCourse: { status: "active", adherence: "unknown", lastResponseAt: null, notes: null, reminders: [] },
  medicationReminder: { status: "scheduled", sentAt: null },
  therapyPlan: { status: "planned", name: null, notes: null, sessions: [] },
  therapySession: { status: "scheduled", completedAt: null, notes: null },
  followUp: { status: "pending", priority: "medium", completedAt: null },
  labReferral: { status: "pending" },
  treatmentPlan: { status: "planned", startedAt: null, completedAt: null },
  task: { status: "open", priority: "medium" },
  referral: { status: "pending", revenue: 0, rewardEligible: false },
  communicationLog: { status: "queued" },
  waitlistEntry: { status: "waiting", priority: 0 },
  patient: { category: "new_patient", lifetimeVisits: 0, lifetimeRevenue: 0, isNew: true, consentWhatsapp: false, consentSms: false, consentEmail: false, bookings: [], leads: [], followUps: [], communications: [], admissionRecs: [], referralsGiven: [], referralsGot: [], consultations: [], documents: [], retention: null },
  camp: { status: "planned", revenue: 0, patientsScreened: 0, isRecurring: false, venue: null, venueCapacity: null, expectedPatients: null, expectedAdmissions: null, branchId: null, diseaseId: null, expenses: [], staffRoster: [], revenueLines: [], planning: {}, _count: { campPatients: 0 }, campPatients: [] },
  campPatient: { recommendedVisit: false, leadId: null },
  mobileClinic: { status: "planned", patientsScreened: 0, isRecurring: false, venue: null, venueCapacity: null, expectedPatients: null, expectedAdmissions: null, branchId: null, diseaseId: null, expenses: [], staffRoster: [], revenueLines: [], planning: {}, _count: { patients: 0 }, patients: [] },
  mobileClinicPatient: { referredToBranch: false, leadId: null },
  campaign: { budget: 0, active: true },
  organization: { active: true, _count: { camps: 0, referrals: 0 }, camps: [], referrals: [] },
  consultation: {},
};

// Apply update data, honouring Prisma numeric operators ({ increment }, etc.).
function applyData(row: Row, data: Row = {}) {
  for (const [k, v] of Object.entries(data)) {
    if (isObj(v) && ("increment" in v || "decrement" in v || "set" in v || "multiply" in v)) {
      if ("set" in v) row[k] = v.set;
      else if ("increment" in v) row[k] = (row[k] ?? 0) + v.increment;
      else if ("decrement" in v) row[k] = (row[k] ?? 0) - v.decrement;
      else if ("multiply" in v) row[k] = (row[k] ?? 0) * v.multiply;
    } else {
      row[k] = v;
    }
  }
}

// Link a created row's relations from its foreign keys so list pages that read
// non-optional nested relations (booking.patient.name, …) don't crash.
function hydrate(row: Row) {
  const link = (fk: string, model: string, as: string, key = "id") => {
    if (row[fk] != null && !row[as]) {
      const r = (store[model] ?? []).find((x) => x[key] === row[fk]);
      if (r) row[as] = r;
    }
  };
  link("patientMrd", "patient", "patient", "mrd");
  link("doctorId", "doctor", "doctor");
  link("departmentId", "department", "department");
  link("branchId", "branch", "branch");
  link("roomId", "consultationRoom", "room");
  link("leadId", "lead", "lead");
  link("ownerId", "staffUser", "owner");
  link("assigneeId", "staffUser", "assignee");
  link("executiveId", "staffUser", "executive");
  link("sourceId", "leadSourceMaster", "source");
  link("packageId", "admissionPackageMaster", "package");
  link("organizationId", "organization", "organization");
  link("templateId", "communicationTemplate", "template");
  link("campaignId", "campaign", "campaign");
  link("consultationId", "consultation", "consultation");
  link("bookingId", "opBooking", "booking");
  link("referrerPatientMrd", "patient", "referrerPatient", "mrd");
  link("referredPatientMrd", "patient", "referredPatient", "mrd");
  link("courseId", "medicationCourse", "course");
  link("planId", "therapyPlan", "plan");
}
const isObj = (v: unknown): v is Row => typeof v === "object" && v !== null && !(v instanceof Date);

const SCALAR_OPS = ["equals", "in", "notIn", "lt", "lte", "gt", "gte", "not", "contains", "startsWith", "endsWith"];

const toTime = (v: unknown) => (v instanceof Date ? v.getTime() : v);

function matchScalar(value: unknown, cond: Row): boolean {
  for (const [op, operand] of Object.entries(cond)) {
    switch (op) {
      case "equals": if (toTime(value) !== toTime(operand)) return false; break;
      case "in": if (!Array.isArray(operand) || !operand.map(toTime).includes(toTime(value))) return false; break;
      case "notIn": if (Array.isArray(operand) && operand.map(toTime).includes(toTime(value))) return false; break;
      case "lt": if (!(toTime(value)! < toTime(operand)!)) return false; break;
      case "lte": if (!(toTime(value)! <= toTime(operand)!)) return false; break;
      case "gt": if (!(toTime(value)! > toTime(operand)!)) return false; break;
      case "gte": if (!(toTime(value)! >= toTime(operand)!)) return false; break;
      case "not": if (toTime(value) === toTime(operand)) return false; break;
      case "contains": if (!String(value ?? "").toLowerCase().includes(String(operand).toLowerCase())) return false; break;
      case "startsWith": if (!String(value ?? "").toLowerCase().startsWith(String(operand).toLowerCase())) return false; break;
      case "endsWith": if (!String(value ?? "").toLowerCase().endsWith(String(operand).toLowerCase())) return false; break;
      case "mode": break; // case-insensitivity already applied above
      default: break; // unknown op → ignore
    }
  }
  return true;
}

function matchWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") { const arr = Array.isArray(cond) ? cond : [cond]; if (!arr.every((c) => matchWhere(row, c))) return false; continue; }
    if (key === "OR") { const arr = Array.isArray(cond) ? cond : [cond]; if (arr.length && !arr.some((c) => matchWhere(row, c))) return false; continue; }
    if (key === "NOT") { const arr = Array.isArray(cond) ? cond : [cond]; if (arr.some((c) => matchWhere(row, c))) return false; continue; }

    const value = row[key];
    if (cond === null) { if (value !== null && value !== undefined) return false; continue; }
    if (isObj(cond)) {
      const keys = Object.keys(cond);
      const isScalarCond = keys.some((k) => SCALAR_OPS.includes(k) || k === "mode");
      if (isScalarCond) { if (!matchScalar(value, cond)) return false; continue; }
      // Relation filter (some/none/every) or nested object — best-effort: ignore.
      continue;
    }
    // Plain scalar equality (Date-aware).
    if (toTime(value) !== toTime(cond)) return false;
  }
  return true;
}

function applyOrderBy(rows: Row[], orderBy?: Row | Row[]): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [field, dir] of Object.entries(spec)) {
        const av = toTime(a[field]); const bv = toTime(b[field]);
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return dir === "desc" ? 1 : -1;
        if (av > bv) return dir === "desc" ? -1 : 1;
      }
    }
    return 0;
  });
}

function makeDelegate(model: string) {
  const all = (): Row[] => store[model] ?? (store[model] = []);
  const filtered = (where?: Row) => all().filter((r) => matchWhere(r, where));

  return {
    findMany: async (args: Row = {}) => {
      let rows = filtered(args.where);
      rows = applyOrderBy(rows, args.orderBy);
      if (typeof args.skip === "number") rows = rows.slice(args.skip);
      if (typeof args.take === "number") rows = rows.slice(0, args.take);
      return rows;
    },
    findUnique: async (args: Row = {}) => filtered(args.where)[0] ?? null,
    findFirst: async (args: Row = {}) => applyOrderBy(filtered(args.where), args.orderBy)[0] ?? null,
    findUniqueOrThrow: async (args: Row = {}) => {
      const r = filtered(args.where)[0];
      if (!r) throw new Error(`mock: ${model} not found`);
      return r;
    },
    count: async (args: Row = {}) => filtered(args.where).length,
    groupBy: async (args: Row = {}) => {
      const by: string[] = args.by ?? [];
      const rows = filtered(args.where);
      const groups = new Map<string, Row>();
      for (const r of rows) {
        const key = by.map((f) => String(r[f])).join("|");
        let g = groups.get(key);
        if (!g) {
          g = {};
          for (const f of by) g[f] = r[f];
          if (args._count) g._count = { _all: 0 };
          if (args._sum) g._sum = Object.fromEntries(Object.keys(args._sum).map((k) => [k, 0]));
          groups.set(key, g);
        }
        if (args._count) g._count._all += 1;
        if (args._sum) for (const k of Object.keys(args._sum)) g._sum[k] += r[k] ?? 0;
      }
      return [...groups.values()];
    },
    aggregate: async (args: Row = {}) => {
      const rows = filtered(args.where);
      const out: Row = {};
      if (args._sum) out._sum = Object.fromEntries(Object.keys(args._sum).map((k) => [k, rows.reduce((s, r) => s + (r[k] ?? 0), 0)]));
      if (args._count) out._count = rows.length;
      if (args._avg) out._avg = Object.fromEntries(Object.keys(args._avg).map((k) => [k, rows.length ? rows.reduce((s, r) => s + (r[k] ?? 0), 0) / rows.length : 0]));
      return out;
    },
    create: async (args: Row = {}) => {
      const row: Row = { id: nextId(model), createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[model] ?? {}), ...args.data };
      hydrate(row);
      all().unshift(row);
      return row;
    },
    update: async (args: Row = {}) => {
      const row = filtered(args.where)[0];
      if (row) { applyData(row, args.data); row.updatedAt = new Date(); hydrate(row); }
      return row ?? { ...args.where, ...args.data };
    },
    upsert: async (args: Row = {}) => {
      const row = filtered(args.where)[0];
      if (row) { applyData(row, args.update); row.updatedAt = new Date(); hydrate(row); return row; }
      const created: Row = { id: nextId(model), createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[model] ?? {}), ...args.where, ...args.create };
      hydrate(created);
      all().unshift(created);
      return created;
    },
    delete: async (args: Row = {}) => {
      const arr = all();
      const i = arr.findIndex((r) => matchWhere(r, args.where));
      const [removed] = i >= 0 ? arr.splice(i, 1) : [null];
      return removed;
    },
    deleteMany: async (args: Row = {}) => {
      const arr = all();
      const before = arr.length;
      store[model] = arr.filter((r) => !matchWhere(r, args.where));
      return { count: before - store[model].length };
    },
    updateMany: async (args: Row = {}) => {
      const rows = filtered(args.where);
      rows.forEach((r) => applyData(r, args.data));
      return { count: rows.length };
    },
  };
}

export function createMockPrisma() {
  const delegates: Record<string, ReturnType<typeof makeDelegate>> = {};
  const target: Row = {
    $transaction: async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(proxy);
      if (Array.isArray(arg)) return Promise.all(arg);
      return undefined;
    },
    $disconnect: async () => {},
    $connect: async () => {},
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
  };
  const proxy: Row = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (typeof prop === "string" && !prop.startsWith("$")) {
        return (delegates[prop] ??= makeDelegate(prop));
      }
      return undefined;
    },
  });
  return proxy;
}
