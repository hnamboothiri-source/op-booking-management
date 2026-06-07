/**
 * Admission conversion logic (Module 10). Pure state machine for the
 * recommendation → admission funnel, with the rejection-reason guard.
 */

export type AdmissionStatus =
  | "recommended"
  | "counselled"
  | "interested"
  | "postponed"
  | "accepted"
  | "admitted"
  | "rejected"
  | "lost";

const TRANSITIONS: Record<AdmissionStatus, AdmissionStatus[]> = {
  recommended: ["counselled", "rejected", "lost"],
  counselled: ["interested", "postponed", "accepted", "rejected", "lost"],
  interested: ["accepted", "postponed", "rejected", "lost"],
  postponed: ["counselled", "interested", "accepted", "rejected", "lost"],
  accepted: ["admitted", "lost"],
  admitted: [],
  rejected: [],
  lost: [],
};

export function canTransitionAdmission(from: AdmissionStatus, to: AdmissionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextAdmissionStatuses(from: AdmissionStatus): AdmissionStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isAdmissionTerminal(status: AdmissionStatus): boolean {
  return status === "admitted" || status === "rejected" || status === "lost";
}

/** A reason is mandatory when moving to rejected or lost. */
export function admissionNeedsReason(to: AdmissionStatus): boolean {
  return to === "rejected" || to === "lost";
}

/** Conversion = admitted / recommended (the funnel headline). */
export function admissionConversionRate(admitted: number, recommended: number): number {
  if (recommended <= 0) return 0;
  return Math.round((admitted / recommended) * 1000) / 10;
}

// --- Consultation outcomes (Module 5) ---

export type ConsultationOutcome =
  | "medicine_prescribed"
  | "test_recommended"
  | "follow_up_advised"
  | "admission_advised"
  | "surgery_or_procedure_advised"
  | "referred_to_department"
  | "no_treatment_required";

/** Outcomes that should spin up an admission recommendation. */
export function outcomeImpliesAdmission(outcome: ConsultationOutcome): boolean {
  return outcome === "admission_advised" || outcome === "surgery_or_procedure_advised";
}

/** Outcomes that should create a follow-up task. */
export function outcomeImpliesFollowUp(outcome: ConsultationOutcome): boolean {
  return outcome === "follow_up_advised" || outcome === "medicine_prescribed" || outcome === "test_recommended";
}
