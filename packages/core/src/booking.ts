/**
 * Appointment booking logic (Module 3). Pure state machine + slot capacity
 * rules so the API layer can validate transitions and the UI can offer only
 * legal actions. Status set is authoritative (master doc §M3).
 */

export type BookingStatus =
  | "booked"
  | "confirmed"
  | "arrived"
  | "waiting"
  | "in_consultation"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  booked: ["confirmed", "arrived", "cancelled", "rescheduled", "no_show"],
  confirmed: ["arrived", "cancelled", "rescheduled", "no_show"],
  arrived: ["waiting", "in_consultation", "cancelled"],
  waiting: ["in_consultation", "cancelled"],
  in_consultation: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextBookingStatuses(from: BookingStatus): BookingStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** A booking in one of these states occupies a slot (counts against capacity). */
const OCCUPYING: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "booked", "confirmed", "arrived", "waiting", "in_consultation", "completed",
]);

export function occupiesSlot(status: BookingStatus): boolean {
  return OCCUPYING.has(status);
}

/** A booking transitioning to one of these frees its slot. */
export function releasesSlot(to: BookingStatus): boolean {
  return to === "cancelled" || to === "no_show" || to === "rescheduled";
}

export type SlotStatus = "open" | "full" | "blocked" | "cancelled";

export function slotStatusFor(bookedCount: number, capacity: number): Extract<SlotStatus, "open" | "full"> {
  return bookedCount >= capacity ? "full" : "open";
}

export function hasCapacity(bookedCount: number, capacity: number): boolean {
  return bookedCount < capacity;
}

/** Next queue/token number for the day, given the tokens already issued. */
export function nextQueueToken(existing: number[]): number {
  return (existing.length ? Math.max(...existing) : 0) + 1;
}

/**
 * Whether a room is already occupied by another booking at the same date+time.
 * `existing` are other bookings in that room on that date (status-filtered by
 * the caller); pure so the action layer can reject conflicts.
 */
export function roomConflict(
  existing: { startTime: string }[],
  candidateStartTime: string,
): boolean {
  return existing.some((b) => b.startTime === candidateStartTime);
}

// --- Appointment reminders (FRS §14) ---

export type ReminderKind = "day_before" | "morning";

export interface ReminderCandidate {
  bookingId: string;
  /** Appointment day (Date or ISO/yyyy-mm-dd string). */
  appointmentDate: Date | string;
  status: BookingStatus;
  /** Reminder kinds already sent for this booking. */
  sentKinds: string[];
}

const dayKey = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * Which reminders are due now: a **day-before** reminder for tomorrow's
 * still-open appointments and a **morning-of** reminder for today's, skipping
 * any already sent. Pure so the cron can sweep idempotently.
 */
export function dueReminders(items: ReminderCandidate[], now: Date): { bookingId: string; kind: ReminderKind }[] {
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const out: { bookingId: string; kind: ReminderKind }[] = [];
  for (const it of items) {
    if (it.status !== "booked" && it.status !== "confirmed") continue;
    const k = dayKey(it.appointmentDate);
    if (k === tomorrow && !it.sentKinds.includes("day_before")) out.push({ bookingId: it.bookingId, kind: "day_before" });
    if (k === today && !it.sentKinds.includes("morning")) out.push({ bookingId: it.bookingId, kind: "morning" });
  }
  return out;
}

// --- Real-schedule helpers (Sreedhareeyam doctor/room/slot plan) ---

/**
 * Divide a session window into exactly `count` equal back-to-back slots
 * ("‑Nnos" = N patients in that window). e.g. ("09:00","12:30",7) → 7 slots of
 * 30 min each. Falls back to one slot when count ≤ 1.
 */
export function splitSessionSlots(start: string, end: string, count: number): { start: string; end: string }[] {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toStr = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const s = toMin(start), e = toMin(end);
  const n = Math.max(1, Math.floor(count));
  if (e <= s) return [{ start, end }];
  const step = Math.floor((e - s) / n);
  return Array.from({ length: n }, (_, i) => ({ start: toStr(s + i * step), end: toStr(i === n - 1 ? e : s + (i + 1) * step) }));
}

/** Minutes between two "HH:MM" times (0 if end ≤ start). */
export function minutesBetween(start: string, end: string): number {
  const m = (t: string) => { const [h, mm] = t.split(":").map(Number); return (h || 0) * 60 + (mm || 0); };
  return Math.max(0, m(end) - m(start));
}

/** Slot utilisation % = used / allotted, clamped 0–100, 0 when allotted is 0. */
export function slotUtilisation(used: number, allotted: number): number {
  if (allotted <= 0) return 0;
  return Math.min(100, Math.round((used / allotted) * 100));
}

/** Human label for a week-of-month rotation tag, e.g. "1,3" → "1st & 3rd Sun/Sat". */
export function weekOfMonthLabel(weekOfMonth?: string | null): string {
  if (!weekOfMonth) return "";
  const ord = (n: string) => ({ "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th" }[n.trim()] ?? n.trim());
  return weekOfMonth.split(/[,&]/).map((p) => p.trim()).filter(Boolean).map(ord).join(" & ");
}

/**
 * Generate slot start/end times for a session.
 * e.g. ("09:00","12:00",30) → [{start:"09:00",end:"09:30"}, ...].
 */
export function generateSlotTimes(
  start: string,
  end: string,
  durationMinutes: number,
): { start: string; end: string }[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toStr = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const out: { start: string; end: string }[] = [];
  for (let t = toMin(start); t + durationMinutes <= toMin(end); t += durationMinutes) {
    out.push({ start: toStr(t), end: toStr(t + durationMinutes) });
  }
  return out;
}
