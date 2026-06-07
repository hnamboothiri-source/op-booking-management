/**
 * Predictive lead prioritization (Phase 5 — "AI-based patient prioritization").
 * A transparent, rule-based propensity score over the signals we already
 * capture. It produces the same shape an ML model would (score + factor
 * breakdown), so the heuristic can later be swapped for a trained model without
 * changing call sites.
 */
import type { LeadStage } from "./leads";

export interface LeadSignals {
  priority: "low" | "medium" | "high";
  /** followUpDate has passed. */
  overdueFollowUp: boolean;
  /** Most recent call outcome, if any (raw enum string). */
  lastOutcome?: string | null;
  stage: LeadStage;
  /** Days since the lead was created (older open leads decay). */
  ageDays: number;
}

export interface PropensityResult {
  score: number; // 0..100 — higher = call sooner
  factors: Record<string, number>;
  rank: "hot" | "warm" | "cold";
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const OUTCOME_WEIGHT: Record<string, number> = {
  interested_in_admission: 25,
  asked_for_treatment_cost: 15,
  interested_in_branch_visit: 15,
  asked_for_doctor_details: 10,
  follow_up_required: 5,
  call_later: 0,
  not_reachable: -5,
  not_interested: -40,
  appointment_booked: 0,
};

const STAGE_WEIGHT: Partial<Record<LeadStage, number>> = {
  interested: 20,
  appointment_suggested: 15,
  contacted: 5,
  new_lead: 10,
  not_reachable: -10,
  not_interested: -100,
  lost: -100,
};

/** Score an open lead's propensity to convert / urgency to contact. */
export function leadPropensityScore(s: LeadSignals): PropensityResult {
  const factors: Record<string, number> = {
    base: 30,
    priority: s.priority === "high" ? 25 : s.priority === "medium" ? 10 : 0,
    overdue: s.overdueFollowUp ? 15 : 0,
    outcome: s.lastOutcome ? (OUTCOME_WEIGHT[s.lastOutcome] ?? 0) : 0,
    stage: STAGE_WEIGHT[s.stage] ?? 0,
    // Freshness decay: −1 per 3 days open, capped at −15.
    age: -Math.min(15, Math.floor(Math.max(0, s.ageDays) / 3)),
  };
  const score = clamp(Object.values(factors).reduce((a, b) => a + b, 0));
  const rank = score >= 65 ? "hot" : score >= 40 ? "warm" : "cold";
  return { score, factors, rank };
}
