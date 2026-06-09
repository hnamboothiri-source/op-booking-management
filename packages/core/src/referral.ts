/**
 * Referral Relationship Management (Module 6) — pure scoring + shaping helpers.
 * Score storage mirrors PatientScore ({ score 0..100, factors }). Revenue/funnel
 * tracing lives in the web layer (needs prisma); this file is framework-free + tested.
 */
import type { ScoreResult } from "./scoring";
import { conversionRate } from "./leads";

export const REFERRER_TYPES = ["doctor", "hospital", "ayurveda_practitioner", "corporate", "institutional"] as const;
export type ReferrerType = (typeof REFERRER_TYPES)[number];

export const REFERRER_TYPE_LABELS: Record<ReferrerType, string> = {
  doctor: "Doctor",
  hospital: "Hospital",
  ayurveda_practitioner: "Ayurveda Practitioner",
  corporate: "Corporate",
  institutional: "Institution",
};

export const REFERRER_INTERACTION_TYPES = ["visit", "call", "meeting", "cme", "thank_you", "proposal", "feedback", "other"] as const;
export type ReferrerInteractionType = (typeof REFERRER_INTERACTION_TYPES)[number];

/** Funnel stages for the referral performance chart (received → … → admission). */
export const REFERRAL_FUNNEL_STAGES = ["received", "appointment", "consultation", "treatment", "admission"] as const;
export type ReferralFunnelStage = (typeof REFERRAL_FUNNEL_STAGES)[number];

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Patient referrers earn flat points per referral (master rule: 1 referral = 10 points). */
export function patientReferrerPoints(referralCount: number): number {
  return Math.max(0, Math.round(referralCount)) * 10;
}

export interface ReferralScoreInputs {
  /** Total referrals attributed to this referrer. */
  referralCount: number;
  /** Referrals that reached consultation or beyond (status consulted|admitted). */
  convertedCount: number;
  /** Attributed downstream revenue in paise. */
  attributedRevenue: number;
}

/**
 * Composite referrer score (doctor / corporate / institution): volume + conversion
 * + revenue, each capped, summed and clamped to 0..100. Factors are explainable.
 */
export function referralScore(i: ReferralScoreInputs): ScoreResult {
  const rate = conversionRate(i.convertedCount, i.referralCount); // 0..100, divide-by-zero safe
  const revenueLakh = i.attributedRevenue / 100 / 100000; // paise → ₹ lakh
  const factors: Record<string, number> = {
    volume: Math.min(40, Math.max(0, i.referralCount) * 4), // 4 pts/referral, cap 40
    conversion: Math.round((rate / 100) * 40), // up to 40 pts
    revenue: Math.min(20, Math.round(revenueLakh * 4)), // 4 pts / ₹1L, cap 20
  };
  return { score: clamp(Object.values(factors).reduce((a, b) => a + b, 0)), factors };
}
