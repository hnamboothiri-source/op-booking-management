import { describe, it, expect } from "vitest";
import { budgetTotals, onSiteRevenue, outreachRoi, costPerPatient, expensesByCategory } from "./outreach";

describe("outreach budgetTotals", () => {
  const expenses = [
    { category: "venue_rent" as const, planned: 500000, actual: 480000 },
    { category: "transport_driver" as const, planned: 200000, actual: 220000 },
    { category: "marketing_ads" as const, planned: 300000, actual: 150000 },
  ];
  const roster = [
    { role: "doctor" as const, honorarium: 400000 },
    { role: "driver" as const, honorarium: 100000 },
  ];
  it("rolls up planned/actual incl. staff honoraria", () => {
    const t = budgetTotals(expenses, roster);
    expect(t.staffCost).toBe(500000);
    expect(t.plannedExpenses).toBe(1000000);
    expect(t.actualExpenses).toBe(850000);
    expect(t.plannedTotal).toBe(1500000);
    expect(t.actualTotal).toBe(1350000);
    expect(t.variance).toBe(-150000); // under budget
  });
  it("handles empty inputs", () => {
    expect(budgetTotals().plannedTotal).toBe(0);
    expect(budgetTotals([], []).actualTotal).toBe(0);
  });
});

describe("outreach revenue + ROI", () => {
  it("sums on-site revenue", () => {
    expect(onSiteRevenue([{ kind: "registration", amount: 50000 }, { kind: "medicine_sales", amount: 120000 }])).toBe(170000);
  });
  it("computes ROI from spend, on-site and downstream", () => {
    const r = outreachRoi(1000000, 200000, 2500000); // spend 10k, onsite 2k, downstream 25k
    expect(r.revenue).toBe(2700000);
    expect(r.net).toBe(1700000);
    expect(r.roi).toBe(170); // (2.7M-1M)/1M = 170%
  });
  it("ROI is null when no spend", () => {
    expect(outreachRoi(0, 5000, 0).roi).toBeNull();
  });
});

describe("outreach cost-per-patient + grouping", () => {
  it("cost per patient guards against zero", () => {
    expect(costPerPatient(900000, 30)).toBe(30000);
    expect(costPerPatient(900000, 0)).toBeNull();
  });
  it("groups expenses by category", () => {
    const g = expensesByCategory([
      { category: "venue_rent", planned: 100, actual: 90 },
      { category: "venue_rent", planned: 50, actual: 60 },
      { category: "food_consumables", planned: 200, actual: null },
    ]);
    expect(g.venue_rent).toEqual({ planned: 150, actual: 150 });
    expect(g.food_consumables).toEqual({ planned: 200, actual: 0 });
  });
});

import { isActionableRisk, riskTone, SCREENING_RISKS, OUTREACH_FUNNEL_STAGES } from "./outreach";

describe("screening risk", () => {
  it("normal is not actionable; others are", () => {
    expect(isActionableRisk("normal")).toBe(false);
    expect(isActionableRisk("follow_up")).toBe(true);
    expect(isActionableRisk("high_priority")).toBe(true);
    expect(isActionableRisk("admission_candidate")).toBe(true);
  });
  it("tones escalate with risk", () => {
    expect(riskTone("normal")).toBe("slate");
    expect(riskTone("admission_candidate")).toBe("red");
  });
  it("has 4 risks and a 6-stage funnel", () => {
    expect(SCREENING_RISKS).toHaveLength(4);
    expect(OUTREACH_FUNNEL_STAGES).toHaveLength(6);
  });
});
