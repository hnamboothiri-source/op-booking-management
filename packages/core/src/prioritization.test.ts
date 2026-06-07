import { describe, it, expect } from "vitest";
import { leadPropensityScore } from "./prioritization";

describe("leadPropensityScore", () => {
  it("ranks a high-priority, admission-interested, overdue lead as hot", () => {
    const r = leadPropensityScore({
      priority: "high",
      overdueFollowUp: true,
      lastOutcome: "interested_in_admission",
      stage: "interested",
      ageDays: 2,
    });
    // 30 + 25 + 15 + 25 + 20 - 0 = 115 → clamp 100
    expect(r.score).toBe(100);
    expect(r.rank).toBe("hot");
  });

  it("ranks a cold, not-interested lead at the bottom", () => {
    const r = leadPropensityScore({
      priority: "low",
      overdueFollowUp: false,
      lastOutcome: "not_interested",
      stage: "not_interested",
      ageDays: 30,
    });
    expect(r.score).toBe(0);
    expect(r.rank).toBe("cold");
  });

  it("applies freshness decay and bands warm", () => {
    const r = leadPropensityScore({
      priority: "medium",
      overdueFollowUp: false,
      lastOutcome: "asked_for_treatment_cost",
      stage: "contacted",
      ageDays: 9, // −3
    });
    // 30 + 10 + 0 + 15 + 5 − 3 = 57 → warm
    expect(r.score).toBe(57);
    expect(r.rank).toBe("warm");
  });
});
