/**
 * Outreach camps & mobile eye clinic — budget + implementation model (M7/M8).
 * Pure, dependency-free domain logic over the JSON line-item shapes stored on a
 * Camp / MobileClinic. Reuses the campaign money maths so ROI is consistent.
 */
import { roiPct, costPer } from "./campaign";

// ----- Enumerations (mirror the Prisma enums) -----
export type OutreachExpenseCategory =
  | "venue_rent"
  | "transport_driver"
  | "food_consumables"
  | "marketing_ads"
  | "staff_honorarium"
  | "misc";

export type OutreachStaffRole =
  | "doctor"
  | "optometrist"
  | "registration"
  | "pharmacist"
  | "driver"
  | "attender"
  | "coordinator";

export type OutreachRevenueKind = "registration" | "optometry_checkup" | "medicine_sales" | "other";

export const EXPENSE_CATEGORIES: { value: OutreachExpenseCategory; label: string }[] = [
  { value: "venue_rent", label: "Venue rent" },
  { value: "transport_driver", label: "Transport + driver bata" },
  { value: "food_consumables", label: "Food & consumables" },
  { value: "marketing_ads", label: "Marketing / social ads" },
  { value: "staff_honorarium", label: "Staff honorarium" },
  { value: "misc", label: "Miscellaneous" },
];

export const STAFF_ROLES: { value: OutreachStaffRole; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "optometrist", label: "Optometrist" },
  { value: "registration", label: "Registration" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "driver", label: "Driver" },
  { value: "attender", label: "Attender" },
  { value: "coordinator", label: "Coordinator" },
];

export const REVENUE_KINDS: { value: OutreachRevenueKind; label: string }[] = [
  { value: "registration", label: "Registration fees" },
  { value: "optometry_checkup", label: "Optometry checkup" },
  { value: "medicine_sales", label: "Medicine sales" },
  { value: "other", label: "Other" },
];

// ----- Line-item shapes (stored as JSON on the event) -----
export interface OutreachExpenseLine {
  category: OutreachExpenseCategory;
  /** Budgeted amount, paise. */
  planned: number;
  /** Actual spent, paise (null/absent until incurred). */
  actual?: number | null;
  note?: string | null;
}

export interface OutreachStaffLine {
  role: OutreachStaffRole;
  staffId?: string | null;
  name?: string | null;
  /** Bata / honorarium, paise. */
  honorarium: number;
}

export interface OutreachRevenueLine {
  kind: OutreachRevenueKind;
  /** paise */
  amount: number;
  note?: string | null;
}

export interface PlanningChecklist {
  locationIdentified?: boolean;
  venueBooked?: boolean;
  existingPatientsContacted?: boolean;
  adsReleased?: boolean;
  staffArranged?: boolean;
  mobileUnitArranged?: boolean;
}

export const PLANNING_STEPS: { key: keyof PlanningChecklist; label: string }[] = [
  { key: "locationIdentified", label: "Location identified" },
  { key: "venueBooked", label: "Venue booked (with rent provision)" },
  { key: "existingPatientsContacted", label: "Existing local patients contacted for follow-up" },
  { key: "adsReleased", label: "Social-media ads released" },
  { key: "staffArranged", label: "Staff roster arranged" },
  { key: "mobileUnitArranged", label: "Mobile unit / equipment arranged" },
];

const sum = (ns: (number | null | undefined)[]): number => ns.reduce((s: number, n) => s + (n ?? 0), 0);

// ----- Calculators -----

export interface BudgetTotals {
  staffCost: number; // paise — sum of roster honoraria
  plannedExpenses: number; // paise — sum of expense.planned
  actualExpenses: number; // paise — sum of expense.actual
  plannedTotal: number; // plannedExpenses + staffCost
  actualTotal: number; // actualExpenses + staffCost
  variance: number; // actualTotal − plannedTotal (positive = over budget)
}

/** Roll up a budget from its expense lines + staff roster (honoraria count as staff cost). */
export function budgetTotals(
  expenses: OutreachExpenseLine[] = [],
  roster: OutreachStaffLine[] = [],
): BudgetTotals {
  const staffCost = sum(roster.map((r) => r.honorarium));
  const plannedExpenses = sum(expenses.map((e) => e.planned));
  const actualExpenses = sum(expenses.map((e) => e.actual));
  const plannedTotal = plannedExpenses + staffCost;
  const actualTotal = actualExpenses + staffCost;
  return { staffCost, plannedExpenses, actualExpenses, plannedTotal, actualTotal, variance: actualTotal - plannedTotal };
}

/** Sum on-site revenue lines (paise). */
export function onSiteRevenue(lines: OutreachRevenueLine[] = []): number {
  return sum(lines.map((l) => l.amount));
}

export interface OutreachRoi {
  revenue: number; // onSite + downstream
  net: number; // revenue − spend
  roi: number | null; // % (null when spend ≤ 0)
}

/** ROI = (onSite + downstream − spend) / spend. `spend` is usually actualTotal. */
export function outreachRoi(spend: number, onSite: number, downstream: number): OutreachRoi {
  const revenue = onSite + downstream;
  return { revenue, net: revenue - spend, roi: roiPct(revenue, spend) };
}

/** Cost per patient screened (paise), null when none screened. */
export function costPerPatient(spend: number, screened: number): number | null {
  return costPer(spend, screened);
}

/** Group expense planned/actual by category (for reports). */
export function expensesByCategory(expenses: OutreachExpenseLine[] = []): Record<string, { planned: number; actual: number }> {
  const out: Record<string, { planned: number; actual: number }> = {};
  for (const e of expenses) {
    const g = (out[e.category] ??= { planned: 0, actual: 0 });
    g.planned += e.planned ?? 0;
    g.actual += e.actual ?? 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Acquisition-funnel: screening risk category + funnel stages (M7/M8 expansion)
// ---------------------------------------------------------------------------

export type ScreeningRisk = "normal" | "follow_up" | "high_priority" | "admission_candidate";
export const SCREENING_RISKS: ScreeningRisk[] = ["normal", "follow_up", "high_priority", "admission_candidate"];
export const SCREENING_RISK_LABELS: Record<ScreeningRisk, string> = {
  normal: "Normal — no action",
  follow_up: "Follow-up recommended",
  high_priority: "High priority",
  admission_candidate: "Admission candidate",
};

/** Actionable risk (not "normal") → recommend a hospital visit + auto-create a lead. */
export function isActionableRisk(risk: ScreeningRisk): boolean {
  return risk !== "normal";
}

/** Badge tone for a screening risk level. */
export function riskTone(risk: ScreeningRisk): "slate" | "green" | "amber" | "red" | "blue" {
  switch (risk) {
    case "admission_candidate": return "red";
    case "high_priority": return "amber";
    case "follow_up": return "blue";
    default: return "slate";
  }
}

/** Ordered stages of the outreach acquisition funnel. */
export const OUTREACH_FUNNEL_STAGES = ["screened", "recommended", "appointment", "consultation", "treatment", "admission"] as const;
export type OutreachFunnelStage = (typeof OUTREACH_FUNNEL_STAGES)[number];
export const OUTREACH_FUNNEL_LABELS: Record<OutreachFunnelStage, string> = {
  screened: "Screened",
  recommended: "Recommended",
  appointment: "Appointment booked",
  consultation: "Consulted",
  treatment: "Treatment started",
  admission: "Admitted",
};
