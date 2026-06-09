/**
 * Ayurveda patient engagement (Phase 1) — pure helpers for medicine adherence
 * and therapy/Panchakarma session tracking. Framework-free, ISO-date in/out,
 * UTC math (mirrors cadence.ts) so the web layer + reminder/session generation
 * stay unit-testable without a database.
 */

export type Adherence =
  | "unknown" | "on_track" | "missed_doses" | "needs_refill" | "side_effects" | "needs_consult";
export const ADHERENCE_OPTIONS: Adherence[] = ["unknown", "on_track", "missed_doses", "needs_refill", "side_effects", "needs_consult"];
export const ADHERENCE_LABELS: Record<Adherence, string> = {
  unknown: "Not checked",
  on_track: "Taking regularly",
  missed_doses: "Missed doses",
  needs_refill: "Needs refill",
  side_effects: "Side effects",
  needs_consult: "Needs consultation",
};

export type MedReminderKind = "start" | "compliance" | "refill";
export const MED_REMINDER_LABELS: Record<MedReminderKind, string> = {
  start: "Start reminder",
  compliance: "Compliance check",
  refill: "Refill reminder",
};

export type TherapyType = "panchakarma" | "abhyanga" | "shirodhara" | "njavarakizhi" | "kativasthi" | "other";
export const THERAPY_TYPE_OPTIONS: TherapyType[] = ["panchakarma", "abhyanga", "shirodhara", "njavarakizhi", "kativasthi", "other"];
export const THERAPY_TYPE_LABELS: Record<TherapyType, string> = {
  panchakarma: "Panchakarma",
  abhyanga: "Abhyanga",
  shirodhara: "Shirodhara",
  njavarakizhi: "Njavarakizhi",
  kativasthi: "Kativasthi",
  other: "Other therapy",
};

export type Tone = "slate" | "green" | "amber" | "red" | "blue";

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)).toISOString().slice(0, 10);
};

export interface MedCheckpoint {
  kind: MedReminderKind;
  dueDate: string; // ISO yyyy-mm-dd
}

/**
 * The reminder checkpoints for a medicine course: a start reminder (day 1), a
 * mid-course compliance check, and a refill reminder near the end (~80%).
 * Short courses collapse: ≤2 days → start only; otherwise drop any checkpoint
 * that lands on the same day as an earlier one, keeping the list ascending.
 */
export function medicationCheckpoints(startISO: string, durationDays: number): MedCheckpoint[] {
  const start: MedCheckpoint = { kind: "start", dueDate: startISO };
  if (durationDays <= 2) return [start];
  const out: MedCheckpoint[] = [start];
  const complianceOffset = Math.floor(durationDays / 2);
  const refillOffset = Math.round(durationDays * 0.8);
  const seen = new Set<string>([startISO]);
  for (const [kind, offset] of [["compliance", complianceOffset], ["refill", refillOffset]] as [MedReminderKind, number][]) {
    const dueDate = addDays(startISO, offset);
    if (!seen.has(dueDate)) { out.push({ kind, dueDate }); seen.add(dueDate); }
  }
  return out;
}

/** One ISO date per therapy session, spaced `intervalDays` apart from the start. */
export function therapySessionDates(startISO: string, totalSessions: number, intervalDays: number): string[] {
  const n = Math.max(0, totalSessions);
  const step = Math.max(1, intervalDays);
  return Array.from({ length: n }, (_, i) => addDays(startISO, i * step));
}

export interface TherapyProgress {
  completed: number;
  missed: number;
  pending: number;
  pct: number;
}

/** Completion rollup for a therapy plan (pct of total completed, 0 when no sessions). */
export function therapyProgress(total: number, completed: number, missed: number): TherapyProgress {
  const t = Math.max(0, total);
  const c = Math.max(0, completed);
  const m = Math.max(0, missed);
  return {
    completed: c,
    missed: m,
    pending: Math.max(0, t - c - m),
    pct: t > 0 ? Math.round((c / t) * 100) : 0,
  };
}

/** Badge tone for an adherence state. */
export function adherenceTone(a: Adherence): Tone {
  switch (a) {
    case "on_track": return "green";
    case "missed_doses": return "amber";
    case "needs_refill": return "amber";
    case "side_effects": return "red";
    case "needs_consult": return "red";
    default: return "slate";
  }
}
