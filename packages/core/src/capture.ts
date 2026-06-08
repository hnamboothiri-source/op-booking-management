/**
 * Front-line data-entry helpers (Module-wide capture, Phase 24). Constant lists
 * for the outcome/result fields the consolidated reports depend on, plus a tiny
 * required-field guard reused by the capture server actions.
 */

export const TASK_OUTCOMES = ["resolved", "no_answer", "rescheduled", "not_required", "escalated"] as const;
export type TaskOutcome = (typeof TASK_OUTCOMES)[number];

export const REACTIVATION_METHODS = ["call", "whatsapp", "visit", "email"] as const;
export const REACTIVATION_RESULTS = ["promised_visit", "booked", "not_interested", "unreachable", "do_not_contact"] as const;
export type ReactivationResult = (typeof REACTIVATION_RESULTS)[number];

export const ENGAGEMENT_TYPES = ["visit", "call", "email", "meeting"] as const;

/**
 * Return the labels of any required fields that are missing (null/undefined or
 * blank after trim). Server actions throw when this is non-empty so reports
 * never get half-filled rows.
 */
export function requiredMissing(fields: Record<string, { value: unknown; label: string }>): string[] {
  const missing: string[] = [];
  for (const { value, label } of Object.values(fields)) {
    const empty = value === null || value === undefined || (typeof value === "string" && value.trim() === "");
    if (empty) missing.push(label);
  }
  return missing;
}
