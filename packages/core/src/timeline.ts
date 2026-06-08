/**
 * Patient timeline (M4 — 360° patient profile). Merges every patient-linked
 * activity into a single chronological feed.
 *
 * Pure and dependency-free: the web layer fetches Prisma rows and hands this
 * module plain typed records, so the merge/label/sort logic is unit-testable
 * without a database. The instant used for ordering (`at`) is the moment the
 * activity *happened* (e.g. when a booking was made), not a future due date —
 * those land in the detail text instead.
 */

export type TimelineKind =
  | "booking"
  | "consultation"
  | "call"
  | "lead"
  | "follow_up"
  | "communication"
  | "admission"
  | "referral"
  | "waitlist"
  | "document";

export type TimelineTone = "slate" | "green" | "amber" | "red" | "blue";

export interface TimelineEvent {
  /** Unique within a timeline — kind-prefixed source id so React keys are stable. */
  id: string;
  kind: TimelineKind;
  /** Instant the activity happened; used for ordering. */
  at: Date;
  title: string;
  detail?: string;
  tone: TimelineTone;
  /** Optional deep-link into the originating record. */
  href?: string;
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

// --- Source record shapes (structural, not Prisma types) -------------------

export interface BookingSrc {
  id: string;
  bookedAt: Date;
  appointmentDate: Date;
  startTime: string;
  status: string;
  doctorName?: string | null;
  departmentName?: string | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
}

export interface ConsultationSrc {
  id: string;
  createdAt: Date;
  outcome: string;
  doctorName?: string | null;
  diagnosis?: string | null;
}

export interface CallSrc {
  id: string;
  createdAt: Date;
  outcome: string;
  durationSec?: number | null;
  notes?: string | null;
}

export interface LeadSrc {
  id: string;
  createdAt: Date;
  stage: string;
  sourceName?: string | null;
}

export interface FollowUpSrc {
  id: string;
  createdAt: Date;
  type: string;
  status: string;
  dueDate: Date;
}

export interface CommunicationSrc {
  id: string;
  createdAt: Date;
  sentAt?: Date | null;
  channel: string;
  status: string;
  toAddress: string;
}

export interface AdmissionSrc {
  id: string;
  createdAt: Date;
  status: string;
  packageName?: string | null;
  estimatedCost?: number | null;
}

export interface ReferralSrc {
  id: string;
  createdAt: Date;
  type: string;
  status: string;
  /** "given" when this patient referred someone, "received" when referred in. */
  direction: "given" | "received";
}

export interface WaitlistSrc {
  id: string;
  createdAt: Date;
  status: string;
  requestedDate: Date;
  departmentName?: string | null;
}

export interface DocumentSrc {
  id: string;
  uploadedAt: Date;
  label: string;
}

export interface TimelineSources {
  bookings?: BookingSrc[];
  consultations?: ConsultationSrc[];
  calls?: CallSrc[];
  leads?: LeadSrc[];
  followUps?: FollowUpSrc[];
  communications?: CommunicationSrc[];
  admissions?: AdmissionSrc[];
  referrals?: ReferralSrc[];
  waitlist?: WaitlistSrc[];
  documents?: DocumentSrc[];
}

const humanize = (s: string) => s.replace(/_/g, " ");
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

// --- Per-source mappers -----------------------------------------------------

function bookingEvents(b: BookingSrc): TimelineEvent[] {
  const who = [b.doctorName, b.departmentName].filter(Boolean).join(" · ");
  const events: TimelineEvent[] = [
    {
      id: `booking:${b.id}`,
      kind: "booking",
      at: b.bookedAt,
      title: "Appointment booked",
      detail: `${fmtDate(b.appointmentDate)} ${b.startTime}${who ? ` · ${who}` : ""}`,
      tone:
        b.status === "completed"
          ? "green"
          : b.status === "no_show"
            ? "red"
            : "blue",
    },
  ];
  // A cancellation is a distinct moment worth its own entry.
  if (b.cancelledAt) {
    events.push({
      id: `booking-cancel:${b.id}`,
      kind: "booking",
      at: b.cancelledAt,
      title: "Appointment cancelled",
      detail: b.cancellationReason ?? undefined,
      tone: "red",
    });
  }
  return events;
}

function consultationEvent(c: ConsultationSrc): TimelineEvent {
  return {
    id: `consultation:${c.id}`,
    kind: "consultation",
    at: c.createdAt,
    title: "Consultation",
    detail: [c.doctorName, c.diagnosis, humanize(c.outcome)].filter(Boolean).join(" · "),
    tone: "green",
  };
}

function callEvent(c: CallSrc): TimelineEvent {
  const mins = c.durationSec ? `${Math.round(c.durationSec / 60)} min` : null;
  return {
    id: `call:${c.id}`,
    kind: "call",
    at: c.createdAt,
    title: "Call",
    detail: [humanize(c.outcome), mins, c.notes].filter(Boolean).join(" · "),
    tone: c.outcome === "not_reachable" || c.outcome === "not_interested" ? "amber" : "slate",
  };
}

function leadEvent(l: LeadSrc): TimelineEvent {
  return {
    id: `lead:${l.id}`,
    kind: "lead",
    at: l.createdAt,
    title: "Lead",
    detail: [humanize(l.stage), l.sourceName].filter(Boolean).join(" · "),
    tone: "blue",
  };
}

function followUpEvent(f: FollowUpSrc): TimelineEvent {
  const open = f.status === "pending" || f.status === "overdue" || f.status === "missed";
  return {
    id: `followup:${f.id}`,
    kind: "follow_up",
    at: f.createdAt,
    title: "Follow-up",
    detail: `${humanize(f.type)} · due ${fmtDate(f.dueDate)} · ${humanize(f.status)}`,
    tone: f.status === "done" ? "green" : open ? "amber" : "slate",
  };
}

function communicationEvent(c: CommunicationSrc): TimelineEvent {
  return {
    id: `comm:${c.id}`,
    kind: "communication",
    at: c.sentAt ?? c.createdAt,
    title: "Message",
    detail: `${humanize(c.channel)} → ${c.toAddress} · ${humanize(c.status)}`,
    tone: c.status === "failed" ? "red" : c.status === "delivered" || c.status === "read" ? "green" : "slate",
  };
}

function admissionEvent(a: AdmissionSrc): TimelineEvent {
  const bits = [a.packageName, a.estimatedCost ? rupees(a.estimatedCost) : null, humanize(a.status)];
  return {
    id: `admission:${a.id}`,
    kind: "admission",
    at: a.createdAt,
    title: "Admission recommendation",
    detail: bits.filter(Boolean).join(" · "),
    tone: a.status === "admitted" ? "green" : a.status === "rejected" || a.status === "lost" ? "red" : "blue",
  };
}

function referralEvent(r: ReferralSrc): TimelineEvent {
  const verb = r.direction === "given" ? "Gave referral" : "Referred in";
  return {
    id: `referral:${r.id}`,
    kind: "referral",
    at: r.createdAt,
    title: verb,
    detail: `${humanize(r.type)} · ${humanize(r.status)}`,
    tone: "blue",
  };
}

function waitlistEvent(w: WaitlistSrc): TimelineEvent {
  return {
    id: `waitlist:${w.id}`,
    kind: "waitlist",
    at: w.createdAt,
    title: "Waitlist entry",
    detail: [`requested ${fmtDate(w.requestedDate)}`, w.departmentName, humanize(w.status)]
      .filter(Boolean)
      .join(" · "),
    tone: w.status === "promoted" ? "green" : w.status === "waiting" ? "amber" : "slate",
  };
}

function documentEvent(d: DocumentSrc): TimelineEvent {
  return {
    id: `document:${d.id}`,
    kind: "document",
    at: d.uploadedAt,
    title: "Document added",
    detail: d.label,
    tone: "slate",
  };
}

/**
 * Merge all patient-linked sources into one feed, newest first. Ties on the
 * same instant are broken by id so the order is deterministic (stable across
 * reloads and across the unit tests).
 */
export function buildPatientTimeline(s: TimelineSources): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...(s.bookings ?? []).flatMap(bookingEvents),
    ...(s.consultations ?? []).map(consultationEvent),
    ...(s.calls ?? []).map(callEvent),
    ...(s.leads ?? []).map(leadEvent),
    ...(s.followUps ?? []).map(followUpEvent),
    ...(s.communications ?? []).map(communicationEvent),
    ...(s.admissions ?? []).map(admissionEvent),
    ...(s.referrals ?? []).map(referralEvent),
    ...(s.waitlist ?? []).map(waitlistEvent),
    ...(s.documents ?? []).map(documentEvent),
  ];
  return events.sort((a, b) => {
    const d = b.at.getTime() - a.at.getTime();
    return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export interface TimelineDay {
  day: string; // YYYY-MM-DD
  events: TimelineEvent[];
}

/** Group an already-sorted timeline into newest-first day buckets for display. */
export function groupTimelineByDay(events: TimelineEvent[]): TimelineDay[] {
  const days: TimelineDay[] = [];
  for (const e of events) {
    const day = fmtDate(e.at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }
  return days;
}
