import { describe, it, expect } from "vitest";
import { retentionScore, conversionScore, retentionCategory } from "./scoring";
import { rulesFor } from "./automation";

describe("retentionScore", () => {
  it("rewards loyal patients and clamps at 100", () => {
    const r = retentionScore({
      repeatVisit: true,
      followUpCompleted: true,
      referralGiven: true,
      missedFollowUp: false,
      monthsSinceLastVisit: 0,
      admissionRejected: false,
    });
    expect(r.score).toBe(85); // 50 + 15 + 10 + 10
  });

  it("penalises long absence and missed follow-ups, clamps at 0", () => {
    const r = retentionScore({
      repeatVisit: false,
      followUpCompleted: false,
      referralGiven: false,
      missedFollowUp: true,
      monthsSinceLastVisit: 12,
      admissionRejected: true,
    });
    // 50 - 15 - 30 - 10 = -5 -> clamped to 0
    expect(r.score).toBe(0);
  });
});

describe("conversionScore", () => {
  it("scores a high-intent patient highly", () => {
    const r = conversionScore({
      seriousComplaint: true,
      doctorRecommendation: true,
      previousTreatmentHistory: true,
      familyInterest: true,
      costConcern: false,
      distanceKm: 10,
      followUpResponsiveness: 1,
    });
    // 30 + 20 + 20 + 10 + 10 + 0 + 15 = 105 -> clamped 100
    expect(r.score).toBe(100);
  });
});

describe("retentionCategory", () => {
  it("maps months to the doc's 3/6/12 thresholds", () => {
    expect(retentionCategory(1)).toBe("active");
    expect(retentionCategory(3)).toBe("at_risk");
    expect(retentionCategory(6)).toBe("dormant");
    expect(retentionCategory(12)).toBe("lost");
  });
});

describe("automation rulesFor", () => {
  it("creates a lead on website enquiry", () => {
    const rules = rulesFor("website_enquiry_received");
    expect(rules.some((r) => r.actions.some((a) => a.kind === "create_lead"))).toBe(true);
  });
  it("escalates a missed follow-up", () => {
    const rules = rulesFor("follow_up_missed");
    expect(rules.some((r) => r.actions.some((a) => a.kind === "escalate_to_manager"))).toBe(true);
  });
});
