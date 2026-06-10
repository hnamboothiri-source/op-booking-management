import { describe, it, expect } from "vitest";
import {
  quarterSplit, monthsFromQuarters, weeklyAvg, linesTotal, allocationForPeriod,
  activityTotalsByModule, visionActivityStatus, varianceRow,
  allotmentSummary, shareOfTarget,
  type MasterPlanLine, type MasterPlanActivity,
} from "./masterplan";

const line = (over: Partial<MasterPlanLine> = {}): MasterPlanLine => ({
  moduleSlug: "leads", yearlyValue: 12_000_000, ...over, // ₹1,20,000
});

describe("masterplan splits", () => {
  it("even quarter split with remainder on Q4", () => {
    expect(quarterSplit(line({ yearlyValue: 10 }))).toEqual({ q1: 2, q2: 2, q3: 2, q4: 4 });
    const q = quarterSplit(line());
    expect(q.q1 + q.q2 + q.q3 + q.q4).toBe(12_000_000);
  });
  it("explicit quarters win", () => {
    const q = { q1: 1_000_000, q2: 2_000_000, q3: 4_000_000, q4: 5_000_000 };
    expect(quarterSplit(line({ quarters: q }))).toEqual(q);
  });
  it("months derive from quarters, remainder on each quarter's last month", () => {
    const months = monthsFromQuarters({ q1: 10, q2: 30, q3: 30, q4: 30 });
    expect(months).toHaveLength(12);
    expect(months.slice(0, 3)).toEqual([3, 3, 4]); // 10 → 3+3+4
    expect(months.reduce((s, v) => s + v, 0)).toBe(100);
  });
  it("weekly average is yearly/52", () => {
    expect(weeklyAvg(5_200)).toBe(100);
  });
  it("sums line totals", () => {
    expect(linesTotal([line(), line({ yearlyValue: 1 })])).toBe(12_000_001);
    expect(linesTotal()).toBe(0);
  });
});

describe("target-first allotment", () => {
  const lines = [line({ yearlyValue: 6_000 }), line({ moduleSlug: "camps", yearlyValue: 4_000 })];
  it("under-allotted: remaining positive", () => {
    expect(allotmentSummary(20_000, lines)).toEqual({ target: 20_000, allocated: 10_000, remaining: 10_000, pct: 50 });
  });
  it("exactly allotted", () => {
    expect(allotmentSummary(10_000, lines)).toEqual({ target: 10_000, allocated: 10_000, remaining: 0, pct: 100 });
  });
  it("over-allotted: remaining negative", () => {
    expect(allotmentSummary(8_000, lines).remaining).toBe(-2_000);
    expect(allotmentSummary(8_000, lines).pct).toBe(125);
  });
  it("no target → pct null", () => {
    expect(allotmentSummary(0, lines).pct).toBeNull();
  });
  it("share of target rounds to integer paise", () => {
    expect(shareOfTarget(20_000_00, 10)).toBe(2_000_00);
    expect(shareOfTarget(1_000, 33.3)).toBe(333);
  });
});

describe("reverse plan (vision activities)", () => {
  const act = (over: Partial<MasterPlanActivity> & { id: string }): MasterPlanActivity => ({
    activityMasterId: null, moduleSlug: "camps", name: over.id, count: 1, expectedValue: 0, expectedCost: 0, ...over,
  });
  it("totals per module", () => {
    const t = activityTotalsByModule([
      act({ id: "a", moduleSlug: "camps", count: 24, expectedValue: 480_000, expectedCost: 192_000 }),
      act({ id: "b", moduleSlug: "camps", count: 4, expectedValue: 48_000, expectedCost: 20_000 }),
      act({ id: "c", moduleSlug: "leads", count: 12, expectedValue: 120_000, expectedCost: 30_000 }),
    ]);
    expect(t.camps).toEqual({ value: 528_000, cost: 212_000, count: 28 });
    expect(t.leads).toEqual({ value: 120_000, cost: 30_000, count: 12 });
  });
  it("status bucketing: pending → running → done", () => {
    expect(visionActivityStatus(null)).toBe("pending");
    expect(visionActivityStatus({ plans: 0, target: 0, budget: 0, done: 0 })).toBe("pending");
    expect(visionActivityStatus({ plans: 2, target: 20, budget: 100, done: 1 })).toBe("running");
    expect(visionActivityStatus({ plans: 2, target: 20, budget: 100, done: 2 })).toBe("done");
  });
  it("variance: amended vs master, null when not adopted", () => {
    const master = { count: 24, expectedCost: 192_000 };
    expect(varianceRow(master, null)).toEqual({ costVariance: null, costVariancePct: null, countVariance: null });
    const v = varianceRow(master, { plans: 2, target: 30, budget: 240_000, done: 0 });
    expect(v).toEqual({ costVariance: 48_000, costVariancePct: 25, countVariance: 6 });
    // zero master cost → pct null, amount still computed
    expect(varianceRow({ count: 5, expectedCost: 0 }, { plans: 1, target: 5, budget: 1_000, done: 0 }))
      .toEqual({ costVariance: 1_000, costVariancePct: null, countVariance: 0 });
  });
});

describe("allocationForPeriod", () => {
  const l = line({ quarters: { q1: 1_000, q2: 2_000, q3: 3_000, q4: 6_000 }, yearlyValue: 12_000 });
  it("year / half / quarter / month labels", () => {
    expect(allocationForPeriod(l, 2026, "2026")).toBe(12_000);
    expect(allocationForPeriod(l, 2026, "2026-H1")).toBe(3_000);
    expect(allocationForPeriod(l, 2026, "2026-H2")).toBe(9_000);
    expect(allocationForPeriod(l, 2026, "2026-Q3")).toBe(3_000);
    // Q2 = 2000 → months 666, 666, 668 → May is the 2nd month of Q2
    expect(allocationForPeriod(l, 2026, "2026-05")).toBe(666);
    expect(allocationForPeriod(l, 2026, "2026-06")).toBe(668);
  });
  it("rejects other years, junk labels and out-of-range months", () => {
    expect(allocationForPeriod(l, 2026, "2025-Q3")).toBeNull();
    expect(allocationForPeriod(l, 2026, "FY26")).toBeNull();
    expect(allocationForPeriod(l, 2026, "2026-13")).toBeNull();
    expect(allocationForPeriod(l, 2026, null)).toBeNull();
  });
});
