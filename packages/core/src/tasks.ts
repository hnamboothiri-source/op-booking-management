/**
 * Task & Workflow engine (Module 15). Pure state-machine + overdue logic.
 * The DB/API layer calls these to validate transitions and compute status.
 */

export type TaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "overdue"
  | "cancelled"
  | "escalated";

/** Allowed manual transitions. `overdue` is derived, not set directly. */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "completed", "cancelled", "escalated"],
  in_progress: ["completed", "cancelled", "escalated"],
  escalated: ["in_progress", "completed", "cancelled"],
  overdue: ["in_progress", "completed", "cancelled", "escalated"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: TaskStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * A task is overdue when its due date has passed and it is neither terminal nor
 * already escalated. Open/in-progress tasks past due render as `overdue`.
 */
export function isOverdue(
  dueDate: Date | null,
  status: TaskStatus,
  now: Date,
): boolean {
  if (!dueDate) return false;
  if (isTerminal(status) || status === "escalated") return false;
  return dueDate.getTime() < startOfDay(now).getTime();
}

/** Effective (display) status, applying overdue derivation. */
export function effectiveStatus(
  status: TaskStatus,
  dueDate: Date | null,
  now: Date,
): TaskStatus {
  if ((status === "open" || status === "in_progress") && isOverdue(dueDate, status, now)) {
    return "overdue";
  }
  return status;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
