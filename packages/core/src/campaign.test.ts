import { describe, it, expect } from "vitest";
import { costPer, roiPct, campaignKpis, riskFromRetention, monthsBetween, costPerThousandReach, reachToLeadRate, withinHours } from "./campaign";

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
