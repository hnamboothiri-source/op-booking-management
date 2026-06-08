/**
 * Call-center pure helpers (Module 2): overdue ageing buckets, escalation
 * levels, and conversion-funnel rates. Dependency-free so they're unit-testable
 * and shared by the work console + any future automation.
 */

/** Whole days a follow-up is overdue (dueDate strictly before `now`'s day). 0 if not overdue. */
export function overdueAgeDays(dueDate: Date, now: Date): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.floor((day(now) - day(dueDate)) / 86_400_000);
  return diff > 0 ? diff : 0;
}

export type OverdueBucket = "1d" | "2-3d" | "4-6d" | "7d+";

/** Bucket an overdue age (days) for ageing displays. */
export function overdueBucket(days: number): OverdueBucket {
  if (days >= 7) return "7d+";
  if (days >= 4) return "4-6d";
  if (days >= 2) return "2-3d";
  return "1d";
}

/**
 * Escalation level by overdue age:
 *   L1 ≤2d (executive reminder) · L2 3–6d (team leader) ·
 *   L3 7–13d (call-center manager) · L4 ≥14d (management).
 */
export function escalationLevel(days: number): 1 | 2 | 3 | 4 {
  if (days >= 14) return 4;
  if (days >= 7) return 3;
  if (days >= 3) return 2;
  return 1;
}

export const ESCALATION_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "L1 · Executive",
  2: "L2 · Team leader",
  3: "L3 · Manager",
  4: "L4 · Management",
};

/** Percentage of `part` over `whole`, rounded; 0 when `whole` is 0. */
export function funnelRate(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// --- Call-centre desks (Reception / Front Office / Back Office) ----------

export type CallDesk = "reception" | "front_office" | "back_office";

export interface DeskInfo {
  key: CallDesk;
  label: string;
  blurb: string;
  href: string;
}

export const CALL_DESKS: DeskInfo[] = [
  { key: "reception", label: "Reception", blurb: "Inbound enquiry & booking calls from patients", href: "/reception" },
  { key: "front_office", label: "Front Office", blurb: "Review calls to previously-consulted patients", href: "/front-office" },
  { key: "back_office", label: "Back Office", blurb: "Lead nurture — ads, email, WhatsApp, referrals", href: "/back-office" },
];

/** Sources whose leads are direct inbound callers (Reception); everything else is an acquired lead (Back Office). */
export const RECEPTION_SOURCES = ["phone", "walk_in"];

/** Which desk owns a lead, by its source name. */
export function deskForSource(sourceName?: string | null): CallDesk {
  return sourceName && RECEPTION_SOURCES.includes(sourceName) ? "reception" : "back_office";
}

/** Front office owns patient-review follow-ups. */
export function deskForFollowUp(): CallDesk {
  return "front_office";
}

export function deskLabel(key?: string | null): string {
  return CALL_DESKS.find((d) => d.key === key)?.label ?? "—";
}
