import { describe, it, expect } from "vitest";
import {
  retentionCategoryFromDays,
  DEFAULT_RETENTION_THRESHOLDS,
  wellnessScore,
  plvTier,
  isReactivatedOutcome,
  isContactedOutcome,
  RETENTION_OUTCOMES,
  RETENTION_OUTCOME_LABELS,
  RETENTION_OUTCOME_TONE,
  riskBand,
  retentionBand,
  RISK_BAND_LABELS,
  RETENTION_BAND_LABELS,
  REACTIVATION_PROGRAMS,
  REACTIVATION_PROGRAM_LABELS,
} from "./retention";

describe("retentionCategoryFromDays", () => {
  it("uses the 90/180/365 day defaults", () => {
    expect(retentionCategoryFromDays(0)).toBe("active");
    expect(retentionCategoryFromDays(89)).toBe("active");
    expect(retentionCategoryFromDays(90)).toBe("at_risk");
    expect(retentionCategoryFromDays(179)).toBe("at_risk");
    expect(retentionCategoryFromDays(180)).toBe("dormant");
    expect(retentionCategoryFromDays(364)).toBe("dormant");
    expect(retentionCategoryFromDays(365)).toBe("lost");
    expect(retentionCategoryFromDays(900)).toBe("lost");
  });

  it("respects custom thresholds", () => {
    const t = { atRiskDays: 30, dormantDays: 60, lostDays: 120 };
    expect(retentionCategoryFromDays(29, t)).toBe("active");
    expect(retentionCategoryFromDays(30, t)).toBe("at_risk");
    expect(retentionCategoryFromDays(60, t)).toBe("dormant");
    expect(retentionCategoryFromDays(120, t)).toBe("lost");
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_RETENTION_THRESHOLDS).toEqual({ atRiskDays: 90, dormantDays: 180, lostDays: 365 });
  });
});

describe("wellnessScore", () => {
  it("weights adherence 40 / therapy 35 / follow-up 25", () => {
    expect(wellnessScore({ adherencePct: 100, therapyPct: 100, followUpCompliancePct: 100 }).score).toBe(100);
    expect(wellnessScore({ adherencePct: 0, therapyPct: 0, followUpCompliancePct: 0 }).score).toBe(0);
    const r = wellnessScore({ adherencePct: 100, therapyPct: 0, followUpCompliancePct: 0 });
    expect(r.score).toBe(40);
    expect(r.factors.adherence).toBe(40);
  });

  it("clamps out-of-range inputs", () => {
    expect(wellnessScore({ adherencePct: 200, therapyPct: -50, followUpCompliancePct: 200 }).score).toBe(65);
  });
});

describe("plvTier", () => {
  it("maps revenue paise to tiers", () => {
    expect(plvTier(0)).toBe("bronze");
    expect(plvTier(2_499_99)).toBe("bronze");
    expect(plvTier(2_500_00)).toBe("silver");
    expect(plvTier(10_000_00)).toBe("gold");
    expect(plvTier(30_000_00)).toBe("platinum");
  });
});

describe("outcome classifiers", () => {
  it("flags reactivation outcomes", () => {
    expect(isReactivatedOutcome("booked")).toBe(true);
    expect(isReactivatedOutcome("promised_visit")).toBe(true);
    expect(isReactivatedOutcome("not_interested")).toBe(false);
  });
  it("flags contacted outcomes", () => {
    expect(isContactedOutcome("booked")).toBe(true);
    expect(isContactedOutcome("not_interested")).toBe(true);
    expect(isContactedOutcome("no_answer")).toBe(false);
    expect(isContactedOutcome("unreachable")).toBe(false);
  });
  it("labels + tones every outcome (incl. new ones)", () => {
    for (const o of RETENTION_OUTCOMES) {
      expect(RETENTION_OUTCOME_LABELS[o]).toBeTruthy();
      expect(RETENTION_OUTCOME_TONE[o]).toBeTruthy();
    }
    expect(RETENTION_OUTCOMES).toContain("cost_concern");
    expect(RETENTION_OUTCOMES).toContain("treated_elsewhere");
  });
});

describe("riskBand", () => {
  it("bands the 0..100 risk score", () => {
    expect(riskBand(0)).toBe("low");
    expect(riskBand(29)).toBe("low");
    expect(riskBand(30)).toBe("medium");
    expect(riskBand(59)).toBe("medium");
    expect(riskBand(60)).toBe("high");
    expect(riskBand(79)).toBe("high");
    expect(riskBand(80)).toBe("critical");
    expect(riskBand(100)).toBe("critical");
  });
  it("labels every band", () => {
    expect(RISK_BAND_LABELS.critical).toBeTruthy();
  });
});

describe("retentionBand", () => {
  it("bands the retention score per doc §4", () => {
    expect(retentionBand(100)).toBe("active");
    expect(retentionBand(80)).toBe("active");
    expect(retentionBand(79)).toBe("stable");
    expect(retentionBand(60)).toBe("stable");
    expect(retentionBand(59)).toBe("at_risk");
    expect(retentionBand(40)).toBe("at_risk");
    expect(retentionBand(39)).toBe("dormant");
    expect(retentionBand(0)).toBe("dormant");
  });
  it("labels every band", () => {
    expect(RETENTION_BAND_LABELS.active).toBeTruthy();
  });
});

describe("reactivation programs", () => {
  it("labels every program", () => {
    for (const p of REACTIVATION_PROGRAMS) expect(REACTIVATION_PROGRAM_LABELS[p]).toBeTruthy();
    expect(REACTIVATION_PROGRAMS).toContain("panchakarma_renewal");
  });
});
