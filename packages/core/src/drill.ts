/**
 * Drill-down filter helpers (shared by the drill API and the list pages so they
 * always interpret a filter string the same way). Pure and dependency-free.
 *
 * A figure carries a flat `Record<string,string>` of filters, e.g.
 * `{ stage: "interested", doctorId: "abc" }`. A value may be comma-separated to
 * mean "any of" — `{ stage: "appointment_booked,converted_to_patient" }` — which
 * becomes a Prisma `{ in: [...] }` clause. This module owns that one convention.
 */

export type DrillFilters = Record<string, string>;

/** Entity keys the drill registry knows how to query. */
export type DrillEntity =
  | "leads"
  | "appointments"
  | "consultations"
  | "admissions"
  | "followups"
  | "tasks"
  | "patients"
  | "referrals"
  | "communications"
  | "waitlist"
  | "retention"
  | "calls"
  | "campPatients"
  | "mobileClinicPatients"
  | "camps"
  | "mobileClinics"
  | "organizations";

/** One preview row in the drill drawer. */
export interface DrillRow {
  title: string;
  subtitle?: string;
  href?: string;
  badge?: string;
  badgeTone?: "slate" | "green" | "amber" | "red" | "blue";
}

/** Shape returned by GET /api/drill and rendered by the drawer. */
export interface DrillResult {
  title: string;
  total: number;
  listHref: string;
  rows: DrillRow[];
}

/**
 * Turn a single filter value into the Prisma scalar-filter shape: a bare value
 * for equality, or `{ in: [...] }` when comma-separated. Whitespace around
 * commas is trimmed and empty segments dropped.
 */
export function filterToWhereValue(value: string): string | { in: string[] } {
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 1 ? { in: parts } : (parts[0] ?? "");
}

/**
 * Keep only the filter keys an entity actually allows, dropping unknown/empty
 * ones. Used by the API to stop a client from injecting arbitrary `where` keys.
 */
export function pickAllowedFilters(filters: DrillFilters, allowed: readonly string[]): DrillFilters {
  const out: DrillFilters = {};
  for (const key of allowed) {
    const v = filters[key];
    if (typeof v === "string" && v.trim().length > 0) out[key] = v;
  }
  return out;
}

/** Serialize filters into a URL query string (stable key order, encoded). */
export function filtersToQuery(filters: DrillFilters): string {
  const keys = Object.keys(filters).filter((k) => filters[k]?.trim().length > 0).sort();
  return keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(filters[k])}`).join("&");
}

/** Inclusive-lower / exclusive-upper day bounds (UTC midnight). */
export type DateRange = { gte?: Date; lt?: Date };

/** Midnight (UTC) of the given instant's calendar day. */
function startOfDay(now: Date): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Resolve a relative-date token into a Prisma date range, computed from an
 * explicit `now` (kept as a parameter so this stays pure/testable). Used for
 * "due today / overdue / upcoming" style figures on date columns.
 *   today    → [start of today, start of tomorrow)
 *   overdue  → (…, start of today)        — strictly before today
 *   upcoming → [start of tomorrow, …)     — tomorrow onward
 */
export function relativeDateRange(period: string, now: Date): DateRange | null {
  const start = startOfDay(now);
  const next = new Date(start.getTime() + 86_400_000);
  switch (period) {
    case "today":
      return { gte: start, lt: next };
    case "overdue":
      return { lt: start };
    case "upcoming":
      return { gte: next };
    default:
      return null;
  }
}

/** Parse a boolean filter value; undefined when not a clean true/false. */
export function parseBool(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}
