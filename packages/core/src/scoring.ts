/**
 * Patient scoring (M11/M12). Rule-based and explainable; designed to later
 * back an ML model (Phase 5). All factors trace to the master doc §11.
 */

export interface RetentionInputs {
  repeatVisit: boolean;
  followUpCompleted: boolean;
  referralGiven: boolean;
  missedFollowUp: boolean;
  /** Months since last visit (0 if visited recently). */
  monthsSinceLastVisit: number;
  admissionRejected: boolean;
}

export interface ConversionInputs {
  seriousComplaint: boolean;
  doctorRecommendation: boolean;
  previousTreatmentHistory: boolean;
  familyInterest: boolean;
  costConcern: boolean;
  /** Distance from hospital in km. */
  distanceKm: number;
  /** 0..1 — responsiveness to follow-up calls. */
  followUpResponsiveness: number;
}

export interface ScoreResult {
  score: number; // 0..100, clamped
  factors: Record<string, number>;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Retention score: higher = more loyal / lower churn risk.
 * + repeat visit, + follow-up completed, + referral given
 * - missed follow-up, - long no-visit, - admission rejected
 */
export function retentionScore(i: RetentionInputs): ScoreResult {
  const factors: Record<string, number> = {
    base: 50,
    repeatVisit: i.repeatVisit ? 15 : 0,
    followUpCompleted: i.followUpCompleted ? 10 : 0,
    referralGiven: i.referralGiven ? 10 : 0,
    missedFollowUp: i.missedFollowUp ? -15 : 0,
    // -5 per month with no visit, capped at -30 (≈ doc's 6-month dormancy)
    noVisit: -Math.min(30, Math.max(0, i.monthsSinceLastVisit) * 5),
    admissionRejected: i.admissionRejected ? -10 : 0,
  };
  const score = clamp(Object.values(factors).reduce((a, b) => a + b, 0));
  return { score, factors };
}

/**
 * Conversion score: higher = more likely to convert (consult → treat → admit).
 * Used by call centre / admission team to prioritise outreach.
 */
export function conversionScore(i: ConversionInputs): ScoreResult {
  const factors: Record<string, number> = {
    base: 30,
    seriousComplaint: i.seriousComplaint ? 20 : 0,
    doctorRecommendation: i.doctorRecommendation ? 20 : 0,
    previousTreatmentHistory: i.previousTreatmentHistory ? 10 : 0,
    familyInterest: i.familyInterest ? 10 : 0,
    costConcern: i.costConcern ? -15 : 0,
    // distance friction: -1 per 20km, capped at -10
    distance: -Math.min(10, Math.floor(Math.max(0, i.distanceKm) / 20)),
    responsiveness: Math.round(clamp(i.followUpResponsiveness, 0, 1) * 15),
  };
  const score = clamp(Object.values(factors).reduce((a, b) => a + b, 0));
  return { score, factors };
}

export type RetentionCategory = "active" | "at_risk" | "dormant" | "lost";

/** Map months-since-visit to the retention category (doc §M12 rules: 3/6/12 months). */
export function retentionCategory(monthsSinceLastVisit: number): RetentionCategory {
  if (monthsSinceLastVisit >= 12) return "lost";
  if (monthsSinceLastVisit >= 6) return "dormant";
  if (monthsSinceLastVisit >= 3) return "at_risk";
  return "active";
}
