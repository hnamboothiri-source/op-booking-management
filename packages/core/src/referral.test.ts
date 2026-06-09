import { describe, it, expect } from "vitest";
import { patientReferrerPoints, referralScore } from "./referral";

describe("patientReferrerPoints", () => {
  it("10 points per referral", () => {
    expect(patientReferrerPoints(3)).toBe(30);
    expect(patientReferrerPoints(0)).toBe(0);
  });
});

describe("referralScore", () => {
  it("volume + conversion + revenue → 80 for 10 refs / 50% / ₹5L", () => {
    const r = referralScore({ referralCount: 10, convertedCount: 5, attributedRevenue: 5_00_000_00 }); // ₹5L in paise
    expect(r.factors).toEqual({ volume: 40, conversion: 20, revenue: 20 });
    expect(r.score).toBe(80);
  });

  it("zero input → score 0, no NaN", () => {
    const r = referralScore({ referralCount: 0, convertedCount: 0, attributedRevenue: 0 });
    expect(r.score).toBe(0);
    expect(Number.isNaN(r.score)).toBe(false);
  });

  it("clamps at 100 for very high volume + revenue", () => {
    const r = referralScore({ referralCount: 50, convertedCount: 50, attributedRevenue: 10_00_000_00 }); // ₹10L
    expect(r.score).toBe(100); // volume 40 + conversion 40 + revenue 20
  });
});
