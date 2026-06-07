/**
 * Lead lifecycle helpers (Module 1). Lead stages are not a strict machine —
 * an executive may move a lead around — but we capture which stages are
 * terminal/closed and which represent success, for funnel reporting.
 */

export type LeadStage =
  | "new_lead"
  | "contacted"
  | "interested"
  | "appointment_suggested"
  | "appointment_booked"
  | "not_reachable"
  | "not_interested"
  | "converted_to_patient"
  | "lost";

export const LEAD_STAGES: LeadStage[] = [
  "new_lead", "contacted", "interested", "appointment_suggested",
  "appointment_booked", "not_reachable", "not_interested",
  "converted_to_patient", "lost",
];

/** Closed stages need a closure reason and drop out of the active funnel. */
export function isClosedStage(stage: LeadStage): boolean {
  return stage === "not_interested" || stage === "lost";
}

export function isConverted(stage: LeadStage): boolean {
  return stage === "converted_to_patient" || stage === "appointment_booked";
}

/** Open leads still being worked. */
export function isOpenLead(stage: LeadStage): boolean {
  return !isClosedStage(stage) && stage !== "converted_to_patient";
}

/** Lead conversion rate = converted / total, guarded against divide-by-zero. */
export function conversionRate(converted: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((converted / total) * 1000) / 10; // one decimal %
}
