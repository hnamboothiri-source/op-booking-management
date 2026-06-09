/**
 * Follow-up Management (Module 9) — continuity & retention engine helpers.
 * Pure: outcome/mode/closure catalogs + SLA escalation tiers + conversion check.
 */

export type FollowUpOutcome =
  | "appointment_booked" | "will_call_back" | "call_later" | "not_reachable" | "switched_off"
  | "wrong_number" | "not_interested" | "treated_elsewhere" | "medicine_refill_required"
  | "therapy_booked" | "admission_accepted" | "admission_rejected" | "escalated_to_doctor"
  | "medicine_taken_regularly" | "medicine_stopped" | "diet_not_followed" | "lifestyle_not_followed"
  | "therapy_completed" | "therapy_missed" | "panchakarma_postponed" | "wants_online_advice"
  | "needs_medicine_courier" | "side_effect_reported" | "improvement_reported" | "no_improvement_reported";

export const FOLLOWUP_OUTCOMES: FollowUpOutcome[] = [
  "appointment_booked", "will_call_back", "call_later", "not_reachable", "switched_off",
  "wrong_number", "not_interested", "treated_elsewhere", "medicine_refill_required",
  "therapy_booked", "admission_accepted", "admission_rejected", "escalated_to_doctor",
  "medicine_taken_regularly", "medicine_stopped", "diet_not_followed", "lifestyle_not_followed",
  "therapy_completed", "therapy_missed", "panchakarma_postponed", "wants_online_advice",
  "needs_medicine_courier", "side_effect_reported", "improvement_reported", "no_improvement_reported",
];

/** Ayurveda-specific outcomes (grouped separately in the picker + compliance report). */
export const AYURVEDA_OUTCOMES: FollowUpOutcome[] = [
  "medicine_taken_regularly", "medicine_stopped", "diet_not_followed", "lifestyle_not_followed",
  "therapy_completed", "therapy_missed", "panchakarma_postponed", "wants_online_advice",
  "needs_medicine_courier", "side_effect_reported", "improvement_reported", "no_improvement_reported",
];

export const FOLLOWUP_OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  appointment_booked: "Appointment booked", will_call_back: "Will call back", call_later: "Call later",
  not_reachable: "Not reachable", switched_off: "Switched off", wrong_number: "Wrong number",
  not_interested: "Not interested", treated_elsewhere: "Treated elsewhere",
  medicine_refill_required: "Medicine refill required", therapy_booked: "Therapy booked",
  admission_accepted: "Admission accepted", admission_rejected: "Admission rejected",
  escalated_to_doctor: "Escalated to doctor", medicine_taken_regularly: "Medicine taken regularly",
  medicine_stopped: "Medicine stopped", diet_not_followed: "Diet not followed",
  lifestyle_not_followed: "Lifestyle advice not followed", therapy_completed: "Therapy sessions completed",
  therapy_missed: "Therapy sessions missed", panchakarma_postponed: "Panchakarma postponed",
  wants_online_advice: "Wants online doctor advice", needs_medicine_courier: "Needs medicine courier",
  side_effect_reported: "Side effect / discomfort reported", improvement_reported: "Improvement reported",
  no_improvement_reported: "No improvement reported",
};

export type FollowUpContactMode = "call" | "whatsapp" | "sms" | "visit" | "email";
export const FOLLOWUP_CONTACT_MODES: FollowUpContactMode[] = ["call", "whatsapp", "sms", "visit", "email"];

export const FOLLOWUP_CLOSURE_REASONS = [
  "appointment_booked", "refill_completed", "therapy_completed", "admission_completed",
  "not_interested", "unreachable", "treated_elsewhere", "wrong_number", "duplicate", "no_followup_needed",
] as const;
export type FollowUpClosureReason = (typeof FOLLOWUP_CLOSURE_REASONS)[number];
/** Closure reasons that count as a successful (completed) outcome vs a drop-out. */
export const COMPLETED_CLOSURE_REASONS: FollowUpClosureReason[] = ["appointment_booked", "refill_completed", "therapy_completed", "admission_completed", "no_followup_needed"];
export function isCompletedClosure(reason: string): boolean {
  return (COMPLETED_CLOSURE_REASONS as string[]).includes(reason);
}

/** Conversion outcomes (a follow-up that produced a booking / therapy / admission). */
export function isConversionOutcome(o: FollowUpOutcome): boolean {
  return o === "appointment_booked" || o === "therapy_booked" || o === "admission_accepted";
}

export type EscalationNotify = "none" | "executive" | "team_lead" | "manager" | "management";
export interface EscalationTier { level: number; notify: EscalationNotify }

/**
 * SLA escalation tier from days overdue (negative = not yet due).
 * due today → L1 executive · 1d → L2 team lead · 3d → L3 manager · 7d → L4 management.
 */
export function escalationTier(daysOverdue: number): EscalationTier {
  if (daysOverdue >= 7) return { level: 4, notify: "management" };
  if (daysOverdue >= 3) return { level: 3, notify: "manager" };
  if (daysOverdue >= 1) return { level: 2, notify: "team_lead" };
  if (daysOverdue >= 0) return { level: 1, notify: "executive" };
  return { level: 0, notify: "none" };
}

/** Overdue ageing bucket label (for the overdue report). */
export function overdueBucketLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Due today";
  if (daysOverdue === 1) return "1 day";
  if (daysOverdue <= 3) return "2–3 days";
  if (daysOverdue <= 7) return "4–7 days";
  return "More than 7 days";
}

export function outcomeTone(o: FollowUpOutcome): "slate" | "green" | "amber" | "red" | "blue" {
  if (isConversionOutcome(o) || o === "improvement_reported" || o === "therapy_completed" || o === "medicine_taken_regularly") return "green";
  if (o === "not_interested" || o === "treated_elsewhere" || o === "wrong_number" || o === "switched_off" || o === "admission_rejected") return "red";
  if (o === "side_effect_reported" || o === "no_improvement_reported" || o === "medicine_stopped" || o === "therapy_missed" || o === "not_reachable") return "amber";
  return "blue";
}
