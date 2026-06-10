/**
 * Per-centre cost-centre figures. Each centre (hospital / OP centre) is a
 * separate cost centre: planned budget vs actual spend vs revenue. One query
 * per model over the whole centre set, grouped in memory — group totals equal
 * Σ company totals equal Σ centre rows by construction (see core finance.ts).
 */
import {
  budgetTotals, onSiteRevenue, centreFinance, sumFinance,
  type FinanceFigures, type OutreachExpenseLine, type OutreachStaffLine, type OutreachRevenueLine,
  type ActivityLine,
} from "@prm/core";
import { prisma } from "../db";

export interface CostCentreRow extends FinanceFigures {
  id: string;
  name: string;
  type: string;
}

type OutreachRowLike = {
  branchId: string | null;
  status: string;
  expenses: unknown;
  staffRoster: unknown;
  revenueLines: unknown;
};

/** Actual spend + on-site revenue of one outreach event (completed events only). */
function outreachFigures(rows: OutreachRowLike[], branchId: string): { actual: number; onSite: number } {
  let actual = 0;
  let onSite = 0;
  for (const r of rows) {
    if (r.branchId !== branchId) continue;
    // Planned events have no actuals yet — only completed ones count as spend.
    if (r.status !== "completed") continue;
    const totals = budgetTotals(
      (r.expenses as OutreachExpenseLine[] | null) ?? [],
      (r.staffRoster as OutreachStaffLine[] | null) ?? [],
    );
    actual += totals.actualTotal;
    onSite += onSiteRevenue((r.revenueLines as OutreachRevenueLine[] | null) ?? []);
  }
  return { actual, onSite };
}

export async function costCentres(centres: { id: string; name: string; type: string }[]): Promise<CostCentreRow[]> {
  const ids = centres.map((c) => c.id);
  if (!ids.length) return [];
  const inIds = { in: ids };
  const [plans, camps, mobiles, consultations, admissions] = await Promise.all([
    prisma.modulePlan.findMany({ where: { status: "active", branchId: inIds } }),
    prisma.camp.findMany({ where: { branchId: inIds } }),
    prisma.mobileClinic.findMany({ where: { branchId: inIds } }),
    prisma.consultation.findMany({ where: { branchId: inIds } }),
    // Admissions carry no branchId — attribute through their consultation's centre.
    prisma.admissionRecommendation.findMany({ where: { status: "admitted" } }),
  ]);
  const consultationBranch = new Map(consultations.map((c) => [c.id, c.branchId as string | null]));

  return centres.map((c) => {
    const centrePlans = plans.filter((p) => p.branchId === c.id);
    const plannedBudget = centrePlans.reduce((s, p) => s + (p.plannedBudget ?? 0), 0);
    const activityBudgets = centrePlans.reduce(
      (s, p) => s + (((p.activities as unknown as ActivityLine[] | null) ?? []).reduce((t, a) => t + (a.budget ?? 0), 0)),
      0,
    );
    const camp = outreachFigures(camps as unknown as OutreachRowLike[], c.id);
    const mobile = outreachFigures(mobiles as unknown as OutreachRowLike[], c.id);
    const consultationFees = consultations
      .filter((x) => x.branchId === c.id)
      .reduce((s, x) => s + (x.fee ?? 0), 0);
    const admittedRevenue = admissions
      .filter((a) => a.consultationId && consultationBranch.get(a.consultationId) === c.id)
      .reduce((s, a) => s + (a.estimatedCost ?? 0), 0);

    return {
      id: c.id,
      name: c.name,
      type: c.type,
      ...centreFinance({
        plannedBudget,
        activityBudgets,
        outreachActual: camp.actual + mobile.actual,
        outreachOnSite: camp.onSite + mobile.onSite,
        consultationFees,
        admittedRevenue,
      }),
    };
  });
}

/** Company (or group) totals over cost-centre rows. */
export function financeTotals(rows: CostCentreRow[]): FinanceFigures {
  return sumFinance(rows);
}

/** Group memo: campaign marketing spend has no centre attribution. */
export async function unattributedCampaignSpend(): Promise<number> {
  const campaigns = await prisma.campaign.findMany({ where: { active: true } });
  return campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
}
