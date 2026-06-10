/**
 * Module-level planning (every module's "Plan" page). Pure shapes + helpers over
 * the JSON arrays stored on a ModulePlan. Targets may be linked to a module's
 * live KPI (by label) so the page can show target vs actual.
 */

import { isBranchScoped, isCompanyScoped, type RoleName } from "./rbac";

export type PlanStatus = "draft" | "active" | "closed";
export const PLAN_STATUSES: PlanStatus[] = ["draft", "active", "closed"];

export type ActivityStatus = "planned" | "in_progress" | "done";

// ----- Maker-checker-approver -----
// read_only = may view plans but cannot enter, verify or approve.
export type PlanRank = "read_only" | "staff" | "supervisor" | "manager";
export const RANK_ORDER: Record<PlanRank, number> = { read_only: -1, staff: 0, supervisor: 1, manager: 2 };
export type ApprovalStatus = "entered" | "verified" | "approved" | "rejected";

export interface Approval {
  status: ApprovalStatus;
  enteredById?: string | null;
  enteredAt?: string | null;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  note?: string | null;
}

export interface ChangeEntry {
  at: string;
  byId?: string | null;
  byRank?: PlanRank | null;
  action: string; // "entered" | "verified" | "approved" | "rejected" | "edited"
  detail?: string | null;
}

/** Staff and above may enter/edit activities (read_only may not). */
export function canEnter(rank: PlanRank | undefined | null): boolean {
  return rank != null && RANK_ORDER[rank] >= RANK_ORDER.staff;
}
/** A supervisor (or higher) may verify. */
export function canVerify(rank: PlanRank | undefined | null): boolean {
  return rank != null && RANK_ORDER[rank] >= RANK_ORDER.supervisor;
}
/** Only a manager may approve. */
export function canApprove(rank: PlanRank | undefined | null): boolean {
  return rank === "manager";
}
/** The next approval step after the current status. */
export function nextStep(status: ApprovalStatus): "verify" | "approve" | null {
  if (status === "entered") return "verify";
  if (status === "verified") return "approve";
  return null;
}
/**
 * Separation of duties: the actor for a step must differ from the prior actors
 * (enterer ≠ verifier ≠ approver). Administrators may override.
 */
export function separationOk(step: "verify" | "approve", userId: string, a: Approval, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (step === "verify") return a.enteredById !== userId;
  return a.enteredById !== userId && a.verifiedById !== userId;
}

// ----- Org scope (multi-centre planning) -----
/** Plan scope: branchId set = centre plan; companyId only = company plan; both null = group plan. */
export interface PlanScope {
  branchId?: string | null;
  companyId?: string | null;
}

/**
 * May this user act on (edit/verify/approve) a plan with the given scope?
 * Centre-pinned roles cover only their own centre's plans; company-scoped roles
 * cover their company's (and its centres') plans; group roles cover everything.
 * Legacy group plans (both null) stay open to all ranks — rank + separation
 * rules still apply on top.
 */
export function scopeCovers(
  user: { role: RoleName; branchId: string | null; companyId: string | null },
  plan: PlanScope,
): boolean {
  if (!plan.branchId && !plan.companyId) return true; // group/global plan
  if (isBranchScoped(user.role)) return plan.branchId != null && plan.branchId === user.branchId;
  if (isCompanyScoped(user.role)) return plan.companyId != null && plan.companyId === user.companyId;
  return true; // group-level roles
}

export interface TargetLine {
  /** When set, matches a ModuleDef.kpis[].label so the actual can be pulled live. */
  kpiLabel?: string | null;
  label: string;
  target: number;
  /** e.g. "%", "₹", "patients" — display only. */
  unit?: string | null;
  /** Admin-configured custom fields (PlanConfig.entryFields), keyed by field name. */
  custom?: Record<string, unknown>;
}

export interface ActivityLine {
  title: string;
  /** Registry plan-activity key (when typed); free-form when absent. */
  typeKey?: string | null;
  /** Planned count for this activity (target). */
  target?: number | null;
  ownerId?: string | null;
  dueDate?: string | null; // ISO date
  /** paise */
  budget?: number | null;
  status: ActivityStatus;
  /** Set once pushed into the Tasks module. */
  taskId?: string | null;
  /** Set once a draft entity is created from this activity. */
  draftEntityId?: string | null;
  /** Links back to the master plan's vision activity (variance trail). */
  masterActivityId?: string | null;
  /** Maker-checker-approver state. */
  approval?: Approval;
  /** Audit of supervisor/manager edits + step transitions. */
  changeLog?: ChangeEntry[];
  /** Admin-configured custom fields (PlanConfig.entryFields), keyed by field name. */
  custom?: Record<string, unknown>;
}

/** Progress of an actual toward a target (0–100+, one decimal). 0 when target ≤ 0. */
export function planProgressPct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

/** Total budget across activities (paise). */
export function activitiesBudget(activities: ActivityLine[] = []): number {
  return activities.reduce((s, a) => s + (a.budget ?? 0), 0);
}

/** Counts of activities by status. */
export function activityRollup(activities: ActivityLine[] = []): { total: number; done: number; inProgress: number; planned: number } {
  return {
    total: activities.length,
    done: activities.filter((a) => a.status === "done").length,
    inProgress: activities.filter((a) => a.status === "in_progress").length,
    planned: activities.filter((a) => a.status === "planned").length,
  };
}

/** Counts of activities by approval step (no approval object counts as `entered`). */
export interface ApprovalRollup { entered: number; verified: number; approved: number; rejected: number }
export function approvalRollup(activities: ActivityLine[] = []): ApprovalRollup {
  const out: ApprovalRollup = { entered: 0, verified: 0, approved: 0, rejected: 0 };
  for (const a of activities) out[a.approval?.status ?? "entered"] += 1;
  return out;
}
