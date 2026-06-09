import { describe, it, expect } from "vitest";
import { escalationTier, isConversionOutcome, overdueBucketLabel, FOLLOWUP_OUTCOMES, FOLLOWUP_OUTCOME_LABELS, isCompletedClosure } from "./followup";

describe("escalationTier", () => {
  it("maps days overdue to SLA tiers", () => {
    expect(escalationTier(-2)).toEqual({ level: 0, notify: "none" });
    expect(escalationTier(0)).toEqual({ level: 1, notify: "executive" });
    expect(escalationTier(1)).toEqual({ level: 2, notify: "team_lead" });
    expect(escalationTier(3)).toEqual({ level: 3, notify: "manager" });
    expect(escalationTier(7)).toEqual({ level: 4, notify: "management" });
    expect(escalationTier(20).level).toBe(4);
  });
});

describe("overdueBucketLabel", () => {
  it("buckets ageing", () => {
    expect(overdueBucketLabel(1)).toBe("1 day");
    expect(overdueBucketLabel(3)).toBe("2–3 days");
    expect(overdueBucketLabel(5)).toBe("4–7 days");
    expect(overdueBucketLabel(10)).toBe("More than 7 days");
  });
});

describe("outcome helpers", () => {
  it("flags conversion outcomes", () => {
    expect(isConversionOutcome("appointment_booked")).toBe(true);
    expect(isConversionOutcome("therapy_booked")).toBe(true);
    expect(isConversionOutcome("not_reachable")).toBe(false);
  });
  it("every outcome has a label", () => {
    for (const o of FOLLOWUP_OUTCOMES) expect(FOLLOWUP_OUTCOME_LABELS[o]).toBeTruthy();
  });
  it("classifies completed closures", () => {
    expect(isCompletedClosure("appointment_booked")).toBe(true);
    expect(isCompletedClosure("not_interested")).toBe(false);
  });
});
