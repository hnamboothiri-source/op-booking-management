/**
 * Patient Retention & Reactivation (Module 12) — pure helpers for the loyalty
 * & revenue-growth engine. Framework-free + unit-testable. Reuses ScoreResult
 * (scoring.ts) and Tone (engagement.ts); the engine + actions live in apps/web.
 */
import type { ScoreResult, RetentionCategory } from "./scoring";
import type { Tone } from "./engagement";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// ── Reactivation outreach attempt vocabulary ──────────────────────────────
export const RETENTION_CONTACT_MODES = ["call", "whatsapp", "sms", "visit", "email"] as const;
export type RetentionContactMode = (typeof RETENTION_CONTACT_MODES)[number];

export const RETENTION_OUTCOMES = [
  "promised_visit",
  "booked",
  "callback_later",
  "interested_later",
  "cost_concern",
  "shifted_location",
  "treated_elsewhere",
  "not_interested",
  "unreachable",
  "no_answer",
  "do_not_contact",
] as const;
export type RetentionOutcome = (typeof RETENTION_OUTCOMES)[number];

export const RETENTION_OUTCOME_LABELS: Record<RetentionOutcome, string> = {
  promised_visit: "Promised to visit",
  booked: "Appointment booked",
  callback_later: "Call back later",
  interested_later: "Interested later",
  cost_concern: "Cost concern",
  shifted_location: "Shifted location",
  treated_elsewhere: "Treated elsewhere",
  not_interested: "Not interested",
  unreachable: "Unreachable",
  no_answer: "No answer",
  do_not_contact: "Do not contact",
};

export const RETENTION_OUTCOME_TONE: Record<RetentionOutcome, Tone> = {
  promised_visit: "green",
  booked: "green",
  callback_later: "blue",
  interested_later: "blue",
  cost_concern: "amber",
  shifted_location: "slate",
  treated_elsewhere: "red",
  not_interested: "amber",
  unreachable: "slate",
  no_answer: "slate",
  do_not_contact: "red",
};

/** A booked / promised-visit attempt counts as a reactivation. */
export function isReactivatedOutcome(o: string): boolean {
  return o === "booked" || o === "promised_visit";
}
/** Any logged attempt with a real conversation (not a dead-end dial) counts as contact. */
export function isContactedOutcome(o: string): boolean {
  return o !== "no_answer" && o !== "unreachable";
}

// ── Configurable lifecycle thresholds (days since last visit) ─────────────
export interface RetentionThresholds {
  atRiskDays: number;
  dormantDays: number;
  lostDays: number;
}
export const DEFAULT_RETENTION_THRESHOLDS: RetentionThresholds = {
  atRiskDays: 90,
  dormantDays: 180,
  lostDays: 365,
};

/**
 * Configurable, day-based variant of scoring.ts `retentionCategory(months)`.
 * Defaults to 90/180/365 days (doc §M12). Leaves the months-based fn untouched.
 */
export function retentionCategoryFromDays(
  days: number,
  t: RetentionThresholds = DEFAULT_RETENTION_THRESHOLDS,
): RetentionCategory {
  if (days >= t.lostDays) return "lost";
  if (days >= t.dormantDays) return "dormant";
  if (days >= t.atRiskDays) return "at_risk";
  return "active";
}

// ── Ayurveda Wellness Score ────────────────────────────────────────────────
export interface WellnessInputs {
  /** 0..100 — medication adherence (share of courses on-track). */
  adherencePct: number;
  /** 0..100 — therapy/Panchakarma completion. */
  therapyPct: number;
  /** 0..100 — follow-up compliance (done / done+missed). */
  followUpCompliancePct: number;
}

/**
 * Ayurveda Wellness Score 0..100: weighted blend of medicine adherence (40),
 * therapy completion (35) and follow-up compliance (25). Explainable factors.
 */
export function wellnessScore(i: WellnessInputs): ScoreResult {
  const adherence = clamp(i.adherencePct);
  const therapy = clamp(i.therapyPct);
  const followUp = clamp(i.followUpCompliancePct);
  const factors: Record<string, number> = {
    adherence: Math.round(adherence * 0.4),
    therapy: Math.round(therapy * 0.35),
    followUp: Math.round(followUp * 0.25),
  };
  const score = clamp(Object.values(factors).reduce((a, b) => a + b, 0));
  return { score, factors };
}

// ── Patient Lifetime Value tiers ────────────────────────────────────────────
export type PlvTier = "bronze" | "silver" | "gold" | "platinum";
/** Tier from lifetime revenue in paise (₹25k / ₹1L / ₹3L boundaries). */
export function plvTier(lifetimeRevenuePaise: number): PlvTier {
  const r = Math.max(0, lifetimeRevenuePaise);
  if (r >= 30_000_00) return "platinum";
  if (r >= 10_000_00) return "gold";
  if (r >= 2_500_00) return "silver";
  return "bronze";
}
export const PLV_TIER_TONE: Record<PlvTier, Tone> = {
  bronze: "slate",
  silver: "blue",
  gold: "amber",
  platinum: "green",
};

// ── Reactivation funnel ─────────────────────────────────────────────────────
export const REACTIVATION_FUNNEL_STAGES = ["assigned", "contacted", "responded", "booked", "reactivated"] as const;
export type ReactivationFunnelStage = (typeof REACTIVATION_FUNNEL_STAGES)[number];
export const REACTIVATION_FUNNEL_LABELS: Record<ReactivationFunnelStage, string> = {
  assigned: "Assigned",
  contacted: "Contacted",
  responded: "Responded",
  booked: "Booked",
  reactivated: "Reactivated",
};

// ── Risk bands (categorical view of the 0..100 risk score) ───────────────────
export const RISK_BANDS = ["low", "medium", "high", "critical"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];
/** Band a 0..100 risk score: <30 low, <60 medium, <80 high, else critical. */
export function riskBand(riskScore: number): RiskBand {
  if (riskScore >= 80) return "critical";
  if (riskScore >= 60) return "high";
  if (riskScore >= 30) return "medium";
  return "low";
}
export const RISK_BAND_LABELS: Record<RiskBand, string> = { low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical" };
export const RISK_BAND_TONE: Record<RiskBand, Tone> = { low: "green", medium: "amber", high: "red", critical: "red" };

// ── Retention bands (doc §4 score table — presentational, not the day category) ─
export const RETENTION_BANDS = ["active", "stable", "at_risk", "dormant"] as const;
export type RetentionBand = (typeof RETENTION_BANDS)[number];
/** Band a 0..100 retention score: ≥80 active, ≥60 stable, ≥40 at-risk, else dormant. */
export function retentionBand(score: number): RetentionBand {
  if (score >= 80) return "active";
  if (score >= 60) return "stable";
  if (score >= 40) return "at_risk";
  return "dormant";
}
export const RETENTION_BAND_LABELS: Record<RetentionBand, string> = { active: "Active", stable: "Stable", at_risk: "At risk", dormant: "Dormant" };
export const RETENTION_BAND_TONE: Record<RetentionBand, Tone> = { active: "green", stable: "blue", at_risk: "amber", dormant: "red" };

// ── Reactivation campaign programs (Ayurveda-oriented) ───────────────────────
export const REACTIVATION_PROGRAMS = [
  "annual_wellness",
  "panchakarma_renewal",
  "seasonal",
  "arthritis_review",
  "diabetes_review",
  "eye_wellness",
  "senior_program",
] as const;
export type ReactivationProgram = (typeof REACTIVATION_PROGRAMS)[number];
export const REACTIVATION_PROGRAM_LABELS: Record<ReactivationProgram, string> = {
  annual_wellness: "Annual wellness check",
  panchakarma_renewal: "Panchakarma renewal",
  seasonal: "Seasonal Ayurveda program",
  arthritis_review: "Arthritis review",
  diabetes_review: "Diabetes management review",
  eye_wellness: "Eye wellness review",
  senior_program: "Senior citizen program",
};
