/**
 * Lead auto-assignment rules (FRS §5), prototype config aligned with the mock
 * seed ids. In the backend phase these move to an AssignmentRuleMaster table.
 * Rules are evaluated top-down by routeLeadOwner — specific before broad.
 */
import type { AssignmentRule } from "@prm/core";

export const ASSIGNMENT_RULES: AssignmentRule[] = [
  // Referral enquiries go to the front-office desk.
  { match: { sourceGroup: "referral" }, ownerId: "stf-front", label: "auto: referral desk" },
  // Kochi-branch leads route to the Kochi team.
  { match: { branchId: "br-koc" }, ownerId: "stf-front", label: "auto: Kochi team" },
  // Cataract enquiries to the cataract call team.
  { match: { diseaseId: "dis-0" }, ownerId: "stf-callexec", label: "auto: cataract team" },
];

/** Pool owner when no rule matches. */
export const ASSIGNMENT_FALLBACK = "stf-callexec";
