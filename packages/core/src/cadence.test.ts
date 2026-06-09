import { describe, it, expect } from "vitest";
import { cadencePeriods, monthlyBuckets } from "./cadence";

describe("cadencePeriods", () => {
  it("yearly → one period spanning the calendar year", () => {
    const p = cadencePeriods("yearly", 2026);
    expect(p).toHaveLength(1);
    expect(p[0]).toEqual({ label: "2026", start: "2026-01-01", end: "2026-12-31" });
  });

  it("quarterly → Q1..Q4 with correct edges", () => {
    const p = cadencePeriods("quarterly", 2026);
    expect(p).toHaveLength(4);
    expect(p.map((x) => x.label)).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
    expect(p[0]).toEqual({ label: "2026-Q1", start: "2026-01-01", end: "2026-03-31" });
    expect(p[1].end).toBe("2026-06-30");
    expect(p[3]).toEqual({ label: "2026-Q4", start: "2026-10-01", end: "2026-12-31" });
  });

  it("monthly → 12 periods with month-end dates", () => {
    const p = cadencePeriods("monthly", 2026);
    expect(p).toHaveLength(12);
    expect(p[0]).toEqual({ label: "2026-01", start: "2026-01-01", end: "2026-01-31" });
    expect(p[1].end).toBe("2026-02-28"); // non-leap
    expect(p[11]).toEqual({ label: "2026-12", start: "2026-12-01", end: "2026-12-31" });
  });

  it("monthly → leap-year February ends on the 29th", () => {
    const p = cadencePeriods("monthly", 2024);
    expect(p[1]).toEqual({ label: "2024-02", start: "2024-02-01", end: "2024-02-29" });
  });

  it("half_yearly → H1/H2", () => {
    const p = cadencePeriods("half_yearly", 2026);
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ label: "2026-H1", start: "2026-01-01", end: "2026-06-30" });
    expect(p[1]).toEqual({ label: "2026-H2", start: "2026-07-01", end: "2026-12-31" });
  });

  it("custom → empty (free-form entry)", () => {
    expect(cadencePeriods("custom", 2026)).toEqual([]);
  });
});

describe("monthlyBuckets", () => {
  it("returns 12 month buckets", () => {
    const b = monthlyBuckets(2026);
    expect(b).toHaveLength(12);
    expect(b[0].label).toBe("2026-01");
    expect(b[11].label).toBe("2026-12");
  });
});
