/**
 * Planning cadence → period generation. A module's PlanConfig picks a cadence;
 * the Plan page turns it into the concrete set of periods a manager can create
 * a plan for. Pure + framework-free (UTC via Date.UTC so labels are stable).
 *
 * Period labels stay compatible with the existing ModulePlan.period string
 * ("2026", "2026-Q3", "2026-08", "2026-H1").
 */

export type Cadence = "yearly" | "quarterly" | "monthly" | "half_yearly" | "custom";
export const CADENCES: Cadence[] = ["yearly", "quarterly", "monthly", "half_yearly", "custom"];

export const CADENCE_LABELS: Record<Cadence, string> = {
  yearly: "Yearly",
  quarterly: "Quarterly",
  monthly: "Monthly",
  half_yearly: "Half-yearly",
  custom: "Custom (free-form)",
};

export interface CadencePeriod {
  /** Period key/label, e.g. "2026-Q3". */
  label: string;
  /** ISO yyyy-mm-dd. */
  start: string;
  /** ISO yyyy-mm-dd (inclusive last day of the span). */
  end: string;
}

/** Structural mirror of the web app's FieldDef (kept out of core to avoid a ripple). */
export interface FieldDefLike {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  ref?: string;
}

const iso = (y: number, m0: number, d: number): string =>
  new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);

/** Last day of month m0 (0-based) in year y — handles leap February. */
const lastDay = (y: number, m0: number): number => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Ordered period list for a cadence + year. `custom` → [] (admin enters
 * period/start/end free-form, which is the app's pre-existing behaviour).
 */
export function cadencePeriods(cadence: Cadence, year: number): CadencePeriod[] {
  switch (cadence) {
    case "yearly":
      return [{ label: `${year}`, start: iso(year, 0, 1), end: iso(year, 11, 31) }];
    case "half_yearly":
      return [
        { label: `${year}-H1`, start: iso(year, 0, 1), end: iso(year, 5, 30) },
        { label: `${year}-H2`, start: iso(year, 6, 1), end: iso(year, 11, 31) },
      ];
    case "quarterly":
      return [0, 1, 2, 3].map((q) => {
        const startM = q * 3;
        const endM = startM + 2;
        return { label: `${year}-Q${q + 1}`, start: iso(year, startM, 1), end: iso(year, endM, lastDay(year, endM)) };
      });
    case "monthly":
      return Array.from({ length: 12 }, (_, m) => ({
        label: `${year}-${pad(m + 1)}`,
        start: iso(year, m, 1),
        end: iso(year, m, lastDay(year, m)),
      }));
    case "custom":
    default:
      return [];
  }
}

/** 12 month buckets for the yearly month-wise budget grid. */
export function monthlyBuckets(year: number): CadencePeriod[] {
  return cadencePeriods("monthly", year);
}
