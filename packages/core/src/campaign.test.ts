import { describe, it, expect } from "vitest";
import { costPer, roiPct, campaignKpis, riskFromRetention, monthsBetween, costPerThousandReach, reachToLeadRate, withinHours, quoteForReach, campaignPlanTotals } from "./campaign";

describe("campaign cost metrics", () => {
  it("computes cost per unit in paise", () => {
    expect(costPer(5000000, 10)).toBe(500000); // ₹50000 / 10 = ₹5000
    expect(costPer(5000000, 0)).toBeNull();
  });
  it("computes ROI percentage", () => {
    expect(roiPct(7500000, 5000000)).toBe(50); // 50% return
    expect(roiPct(2500000, 5000000)).toBe(-50);
    expect(roiPct(100, 0)).toBeNull();
  });
  it("assembles full KPI object", () => {
    const k = campaignKpis({ leads: 10, leads24h: 6, consultations: 5, admissions: 2, revenue: 7500000, spend: 5000000, promisedReach: 50000, achievedReach: 40000 });
    expect(k.costPerLead).toBe(500000);
    expect(k.costPerAdmission).toBe(2500000);
    expect(k.roi).toBe(50);
    expect(k.costPerReach).toBe(125000); // ₹50000 / 40000 × 1000 = ₹1250 CPM (paise)
    expect(k.reachToLead).toBe(0.03); // 10/40000 × 100
  });
});

describe("campaign reach metrics", () => {
  it("computes CPM and guards zero reach", () => {
    expect(costPerThousandReach(5000000, 40000)).toBe(125000);
    expect(costPerThousandReach(5000000, 0)).toBeNull();
  });
  it("computes reach→lead rate", () => {
    expect(reachToLeadRate(40, 40000)).toBe(0.1);
    expect(reachToLeadRate(5, 0)).toBe(0);
  });
  it("flags the 24h response window", () => {
    const launch = new Date("2026-06-08T09:00:00Z");
    expect(withinHours(new Date("2026-06-08T20:00:00Z"), launch, 24)).toBe(true);
    expect(withinHours(new Date("2026-06-09T10:00:00Z"), launch, 24)).toBe(false);
    expect(withinHours(new Date("2026-06-08T08:00:00Z"), launch, 24)).toBe(false); // before launch
  });
});

describe("quoteForReach", () => {
  it("CPM bills per 1,000 reach", () => {
    expect(quoteForReach({ pricingModel: "cpm", baseRate: 50000, reach: 40000 })).toEqual({ cost: 2000000, effectiveReach: 40000 }); // ₹500 CPM × 40 = ₹20000
  });
  it("flat models ignore reach for cost", () => {
    expect(quoteForReach({ pricingModel: "flat", baseRate: 1500000, reach: 99999 })).toEqual({ cost: 1500000, effectiveReach: 99999 });
  });
  it("applies a discount and bonus reach", () => {
    const q = quoteForReach({ pricingModel: "cpm", baseRate: 50000, reach: 40000, discountPct: 10, bonusReachPct: 15 });
    expect(q.cost).toBe(1800000); // 10% off ₹20000
    expect(q.effectiveReach).toBe(46000); // +15%
  });
});

describe("campaignPlanTotals", () => {
  it("returns zeros for an empty plan", () => {
    expect(campaignPlanTotals([], 0)).toEqual({ promisedReach: 0, quotedCost: 0, budgetUsedPct: null, overBudget: false });
  });
  it("sums reach + cost and computes budget usage", () => {
    const t = campaignPlanTotals([{ promisedReach: 40000, quotedCost: 2000000 }, { promisedReach: 25000, quotedCost: 1500000 }], 5000000);
    expect(t.promisedReach).toBe(65000);
    expect(t.quotedCost).toBe(3500000);
    expect(t.budgetUsedPct).toBe(70);
    expect(t.overBudget).toBe(false);
  });
  it("flags over-budget plans and tolerates null fields", () => {
    const t = campaignPlanTotals([{ promisedReach: null, quotedCost: 6000000 }], 5000000);
    expect(t.promisedReach).toBe(0);
    expect(t.quotedCost).toBe(6000000);
    expect(t.budgetUsedPct).toBe(120);
    expect(t.overBudget).toBe(true);
  });
});

describe("retention risk", () => {
  it("inverts retention score to risk and clamps", () => {
    expect(riskFromRetention(80)).toBe(20);
    expect(riskFromRetention(0)).toBe(100);
    expect(riskFromRetention(120)).toBe(0);
  });
  it("counts whole months between dates", () => {
    expect(monthsBetween(new Date(2025, 9, 1), new Date(2026, 5, 1))).toBe(8);
    expect(monthsBetween(new Date(2026, 5, 1), new Date(2026, 5, 1))).toBe(0);
    expect(monthsBetween(null, new Date(2026, 5, 1))).toBe(0);
  });
});
