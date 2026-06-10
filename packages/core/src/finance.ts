/**
 * Cost-centre finance (every centre is a separate cost centre). Pure combiners
 * so the arithmetic is unit-testable and ties out by construction:
 * group totals = Σ company totals = Σ centre rows.
 *
 * All amounts are integer paise.
 *
 * Basis (prototype): planned = module-plan budgets + activity budgets;
 * spend = outreach actual expenses (camps + mobile clinics) — campaign spend is
 * NOT centre-attributable (no branchId) and is reported as a group memo line;
 * revenue = consultation fees + outreach on-site revenue + admitted admission
 * package values (estimates, attributed via the consultation's centre).
 */

export interface CentreFinanceInput {
  /** Σ plannedBudget of the centre's active plans. */
  plannedBudget: number;
  /** Σ ActivityLine.budget across those plans. */
  activityBudgets: number;
  /** Σ actual outreach spend (expenses actuals + staff honoraria). */
  outreachActual: number;
  /** Σ on-site outreach revenue lines. */
  outreachOnSite: number;
  /** Σ Consultation.fee at the centre. */
  consultationFees: number;
  /** Σ estimatedCost of admitted admissions attributed to the centre. */
  admittedRevenue: number;
}

export interface FinanceFigures {
  planned: number;
  spend: number;
  revenue: number;
  /** revenue − spend */
  net: number;
  /** spend − planned (positive = over plan) */
  variance: number;
}

export function centreFinance(i: CentreFinanceInput): FinanceFigures {
  const planned = i.plannedBudget + i.activityBudgets;
  const spend = i.outreachActual;
  const revenue = i.consultationFees + i.outreachOnSite + i.admittedRevenue;
  return { planned, spend, revenue, net: revenue - spend, variance: spend - planned };
}

/** Σ figures across rows — used for company totals and the group strip. */
export function sumFinance(rows: FinanceFigures[]): FinanceFigures {
  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  return { planned, spend, revenue, net: revenue - spend, variance: spend - planned };
}
