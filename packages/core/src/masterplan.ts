/**
 * Master planning — the budgetary vision statement. A master plan declares the
 * expected business worth for a YEAR, allocated per module, with the four
 * quarter figures adjustable; months and weeks are DERIVED (never edited).
 * Department (module) plans adopt their allocation for a period and the page
 * reads each department's planned figures against the vision.
 *
 * Pure + integer-paise-safe: every split puts the rounding remainder on the
 * LAST bucket so sums always tie out exactly.
 */

export interface QuarterValues {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export interface MasterPlanLine {
  moduleSlug: string;
  /** Expected business worth for the year (paise). */
  yearlyValue: number;
  /** Optional count target for the year. */
  yearlyTarget?: number | null;
  /** Links the target to a module KPI (by label) for live actuals. */
  kpiLabel?: string | null;
  /** Explicit quarter figures (paise); null/missing = even split of yearlyValue. */
  quarters?: QuarterValues | null;
  note?: string | null;
}

/** Split a paise amount into n buckets; remainder lands on the last bucket. */
function evenSplit(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const out = Array.from({ length: n }, () => base);
  out[n - 1] = total - base * (n - 1);
  return out;
}

/** The line's quarter figures: explicit when set, else an even split. */
export function quarterSplit(line: Pick<MasterPlanLine, "yearlyValue" | "quarters">): QuarterValues {
  if (line.quarters) return line.quarters;
  const [q1, q2, q3, q4] = evenSplit(line.yearlyValue, 4);
  return { q1, q2, q3, q4 };
}

/** Twelve monthly figures derived from the quarters (each quarter ÷ 3, remainder on its last month). */
export function monthsFromQuarters(quarters: QuarterValues): number[] {
  return [quarters.q1, quarters.q2, quarters.q3, quarters.q4].flatMap((q) => evenSplit(q, 3));
}

/** Average weekly worth (paise) — display only; weeks are derived, never planned. */
export function weeklyAvg(yearlyValue: number): number {
  return Math.round(yearlyValue / 52);
}

/** Σ yearly worth across lines (paise). */
export function linesTotal(lines: MasterPlanLine[] = []): number {
  return lines.reduce((s, l) => s + (l.yearlyValue ?? 0), 0);
}

// ----- Target-first allotment -----

export interface AllotmentSummary {
  target: number; // the declared yearly target (paise)
  allocated: number; // Σ module allotments
  remaining: number; // target − allocated (negative = over-allotted)
  /** allocated / target %, one decimal; null when no target set. */
  pct: number | null;
}

/** How much of the declared target the module allotments cover. */
export function allotmentSummary(targetValue: number, lines: MasterPlanLine[] = []): AllotmentSummary {
  const allocated = linesTotal(lines);
  return {
    target: targetValue,
    allocated,
    remaining: targetValue - allocated,
    pct: targetValue > 0 ? Math.round((allocated / targetValue) * 1000) / 10 : null,
  };
}

/** A % share of the target as a paise allotment (integer-rounded). */
export function shareOfTarget(targetValue: number, pct: number): number {
  return Math.round((targetValue * pct) / 100);
}

// ----- Reverse plan: activities that achieve the worth -----

/** One vision activity: "N units of catalogue activity X, expecting ₹V at cost ₹C". */
export interface MasterPlanActivity {
  /** Stable row id within the master plan (e.g. "mp-act-3"). */
  id: string;
  activityMasterId: string | null;
  moduleSlug: string;
  /** Snapshot of the catalogue name (survives catalogue edits). */
  name: string;
  /** How many units this year. */
  count: number;
  /** TOTAL expected return (paise) — per-unit × count, director-editable. */
  expectedValue: number;
  /** TOTAL expected cost (paise). */
  expectedCost: number;
  quarter?: "Q1" | "Q2" | "Q3" | "Q4" | null;
}

/** Σ expected value (and cost) of vision activities per module. */
export function activityTotalsByModule(activities: MasterPlanActivity[] = []): Record<string, { value: number; cost: number; count: number }> {
  const out: Record<string, { value: number; cost: number; count: number }> = {};
  for (const a of activities) {
    const t = (out[a.moduleSlug] ??= { value: 0, cost: 0, count: 0 });
    t.value += a.expectedValue;
    t.cost += a.expectedCost;
    t.count += a.count;
  }
  return out;
}

/** A matched (adopted) plan activity, summed across module plans. */
export interface AdoptedTotals {
  plans: number; // how many plan activities reference this vision activity
  target: number; // Σ amended counts
  budget: number; // Σ amended budgets (paise)
  done: number; // how many of them are status done
}

export type VisionActivityStatus = "pending" | "running" | "done";

/** Status bucket for the running/pending chart. */
export function visionActivityStatus(adopted: AdoptedTotals | null | undefined): VisionActivityStatus {
  if (!adopted || adopted.plans === 0) return "pending";
  return adopted.done >= adopted.plans ? "done" : "running";
}

export interface VarianceRow {
  /** Amended − master (paise); positive = managers planned MORE cost than the vision. */
  costVariance: number | null;
  costVariancePct: number | null;
  /** Amended count − master count. */
  countVariance: number | null;
}

/** Master figures vs the managers' amended plan figures. Null when not adopted. */
export function varianceRow(master: Pick<MasterPlanActivity, "count" | "expectedCost">, adopted: AdoptedTotals | null | undefined): VarianceRow {
  if (!adopted || adopted.plans === 0) return { costVariance: null, costVariancePct: null, countVariance: null };
  const costVariance = adopted.budget - master.expectedCost;
  return {
    costVariance,
    costVariancePct: master.expectedCost > 0 ? Math.round((costVariance / master.expectedCost) * 1000) / 10 : null,
    countVariance: adopted.target - master.count,
  };
}

/**
 * The allocation a module-plan period gets from a master-plan line. Period
 * labels follow ModulePlan.period: "2026" (year), "2026-H1"/"2026-H2",
 * "2026-Q1".."2026-Q4", "2026-01".."2026-12". Returns null for a different
 * year, an unparseable label, or custom free-form periods.
 */
export function allocationForPeriod(line: MasterPlanLine, planYear: number, periodLabel: string | null | undefined): number | null {
  if (!periodLabel) return null;
  const m = /^(\d{4})(?:-(H[12]|Q[1-4]|\d{2}))?$/.exec(periodLabel.trim());
  if (!m) return null;
  if (parseInt(m[1], 10) !== planYear) return null;
  const q = quarterSplit(line);
  const part = m[2];
  if (!part) return line.yearlyValue;
  if (part === "H1") return q.q1 + q.q2;
  if (part === "H2") return q.q3 + q.q4;
  if (part.startsWith("Q")) return q[`q${part[1]}` as keyof QuarterValues];
  const month = parseInt(part, 10);
  if (month < 1 || month > 12) return null;
  return monthsFromQuarters(q)[month - 1];
}
