import { describe, it, expect } from "vitest";
import { centreFinance, sumFinance, type CentreFinanceInput } from "./finance";

const input = (over: Partial<CentreFinanceInput> = {}): CentreFinanceInput => ({
  plannedBudget: 0, activityBudgets: 0, outreachActual: 0, outreachOnSite: 0, consultationFees: 0, admittedRevenue: 0, ...over,
});

describe("cost-centre finance", () => {
  it("combines planned, spend and revenue", () => {
    const f = centreFinance(input({
      plannedBudget: 100_000, activityBudgets: 20_000,
      outreachActual: 90_000, outreachOnSite: 30_000,
      consultationFees: 50_000, admittedRevenue: 200_000,
    }));
    expect(f).toEqual({ planned: 120_000, spend: 90_000, revenue: 280_000, net: 190_000, variance: -30_000 });
  });
  it("zero input yields zero figures", () => {
    expect(centreFinance(input())).toEqual({ planned: 0, spend: 0, revenue: 0, net: 0, variance: 0 });
  });
  it("flags over-plan spend as positive variance", () => {
    const f = centreFinance(input({ plannedBudget: 10_000, outreachActual: 15_000 }));
    expect(f.variance).toBe(5_000);
  });
  it("ties out: sum of centres == company total == sum of company totals", () => {
    const centres = [
      centreFinance(input({ plannedBudget: 100, outreachActual: 40, consultationFees: 70 })),
      centreFinance(input({ activityBudgets: 50, outreachOnSite: 30, admittedRevenue: 25 })),
      centreFinance(input({ plannedBudget: 10, outreachActual: 5 })),
    ];
    const companyA = sumFinance(centres.slice(0, 2));
    const companyB = sumFinance(centres.slice(2));
    const group = sumFinance(centres);
    expect(sumFinance([companyA, companyB])).toEqual(group);
    expect(group.planned).toBe(160);
    expect(group.spend).toBe(45);
    expect(group.revenue).toBe(125);
    expect(group.net).toBe(group.revenue - group.spend);
  });
});
