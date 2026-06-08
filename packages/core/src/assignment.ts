/**
 * Lead auto-assignment engine (FRS §5). A transparent, rule-based router that
 * picks an owner for a new lead from its location / disease / source-group
 * signals. Pure and dependency-free so it is unit-tested and can later be
 * swapped for a load-balanced or ML assignment service without changing call
 * sites. The action layer supplies the rule set (seeded config in the
 * prototype; a master table in the backend phase).
 */

export interface AssignmentSignals {
  branchId?: string | null;
  diseaseId?: string | null;
  sourceGroup?: string | null;
}

export interface AssignmentRule {
  /** All defined keys must equal the matching signal for the rule to fire. */
  match: { branchId?: string; diseaseId?: string; sourceGroup?: string };
  ownerId: string;
  label?: string;
}

export interface AssignmentResult {
  ownerId: string | null;
  reason: string;
}

/**
 * Resolve the owner for a lead. Rules are evaluated in order; the first whose
 * `match` is fully satisfied wins (so put specific rules before broad ones).
 * Falls back to `fallbackOwnerId` (e.g. round-robin pick) or null/unassigned.
 */
export function routeLeadOwner(signals: AssignmentSignals, rules: AssignmentRule[], fallbackOwnerId: string | null = null): AssignmentResult {
  for (const rule of rules) {
    const m = rule.match;
    const ok =
      (m.branchId === undefined || m.branchId === signals.branchId) &&
      (m.diseaseId === undefined || m.diseaseId === signals.diseaseId) &&
      (m.sourceGroup === undefined || m.sourceGroup === signals.sourceGroup);
    if (ok) return { ownerId: rule.ownerId, reason: rule.label ?? "auto-assigned by rule" };
  }
  return { ownerId: fallbackOwnerId, reason: fallbackOwnerId ? "auto: fallback owner" : "left unassigned" };
}
