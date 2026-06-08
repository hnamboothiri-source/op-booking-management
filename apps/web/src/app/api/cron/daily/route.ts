import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@prm/integrations";
import { prisma } from "@/lib/db";
import { runRetentionRecompute } from "@/lib/retention/engine";
import { runAutomation } from "@/lib/automation";
import { leadTier } from "@/lib/leads/tier";
import { dueReminders } from "@prm/core";

/**
 * Daily automation job (Phase 5 — advanced automation). Intended to be invoked
 * by a scheduler (Vercel Cron / GitHub Action / external cron) once a day.
 *
 * Auth: if CRON_SECRET is set, the caller must send `Authorization: Bearer
 * <secret>` (or `?key=<secret>`). When unset (local dev) the route is open.
 *
 * Work: (1) recompute retention for all patients; (2) dispatch reminders for
 * follow-ups due today or overdue, respecting consent, logging each send.
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const key = req.nextUrl.searchParams.get("key");
  return bearer === secret || key === secret;
}

async function handle(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const retention = await runRetentionRecompute();

  // Dispatch due/overdue follow-up reminders.
  const today = new Date(new Date().toISOString().slice(0, 10));
  const tomorrow = new Date(today.getTime() + 86400000);
  const due = await prisma.followUp.findMany({
    where: { status: { in: ["pending", "booked"] }, dueDate: { lt: tomorrow } },
    include: { patient: true },
    take: 1000,
  });

  async function dispatch(patientMrd: string, to: string, template: string, body: string) {
    const res = await sendMessage({ channel: "whatsapp", to, template });
    await prisma.communicationLog.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { patientMrd, channel: "whatsapp", toAddress: to, body, status: res.status as any, sentAt: new Date() },
    });
  }

  let remindersSent = 0;
  for (const f of due) {
    const to = f.patient.consentWhatsapp ? (f.patient.whatsapp ?? f.patient.phone) : null;
    if (!to) continue;
    await dispatch(f.patientMrd, to, "follow_up_reminder", "Follow-up reminder");
    remindersSent++;
  }

  // Engagement messages (master doc §M11): birthday wishes + annual-checkup reminders.
  const consented = await prisma.patient.findMany({
    where: { consentWhatsapp: true, OR: [{ whatsapp: { not: null } }, { phone: { not: null } }] },
    take: 5000,
  });
  const mmdd = (d: Date) => `${d.getUTCMonth()}-${d.getUTCDate()}`;
  const todayMmdd = mmdd(today);
  const annualLo = new Date(today.getTime() - 370 * 86400000);
  const annualHi = new Date(today.getTime() - 360 * 86400000);

  let birthdaysSent = 0;
  let annualReminders = 0;
  for (const p of consented) {
    const to = p.whatsapp ?? p.phone;
    if (!to) continue;
    if (p.dateOfBirth && mmdd(p.dateOfBirth) === todayMmdd) {
      await dispatch(p.mrd, to, "birthday_wishes", "Happy birthday from Sreedhareeyam!");
      birthdaysSent++;
    }
    if (p.lastVisitDate && p.lastVisitDate >= annualLo && p.lastVisitDate <= annualHi) {
      await dispatch(p.mrd, to, "annual_checkup", "It's been about a year — time for your annual checkup.");
      annualReminders++;
    }
  }

  // SLA: escalate open, uncontacted leads whose first-response SLA is breached
  // for their priority tier (hot 15m · warm 2h · cold 24h). Idempotent — skip
  // leads that already have an escalated task.
  const now = new Date();
  const openLeads = await prisma.lead.findMany({
    where: { mergedIntoId: null, stage: { in: ["new_lead", "contacted", "interested", "not_reachable", "appointment_suggested"] }, calls: { none: {} } },
    take: 2000,
  });
  const breached = openLeads.filter((l) => leadTier(l, now).sla === "breached");
  let slaEscalations = 0;
  if (breached.length > 0) {
    const ids = breached.map((l) => l.id);
    const alreadyEscalated = new Set(
      (await prisma.task.findMany({ where: { leadId: { in: ids }, status: "escalated" }, select: { leadId: true } }))
        .map((t) => t.leadId),
    );
    for (const l of breached) {
      if (alreadyEscalated.has(l.id)) continue;
      await runAutomation("lead_uncontacted_sla_breached", { leadId: l.id });
      slaEscalations++;
    }
  }

  // Appointment reminders (FRS §14): day-before (tomorrow) + morning-of (today).
  // Idempotent — any existing reminder of the same kind blocks a re-send.
  const windowEnd = new Date(today.getTime() + 2 * 86400000);
  const upcoming = await prisma.opBooking.findMany({
    where: { status: { in: ["booked", "confirmed"] }, appointmentDate: { gte: today, lt: windowEnd } },
    include: { patient: true },
    take: 1000,
  });
  const byId = new Map(upcoming.map((b) => [b.id, b]));
  // Read existing reminders fresh (not via include) so re-runs are idempotent.
  const existingReminders = await prisma.appointmentReminder.findMany({ where: { bookingId: { in: upcoming.map((b) => b.id) } }, select: { bookingId: true, kind: true } });
  const sentByBooking = new Map<string, string[]>();
  for (const r of existingReminders) sentByBooking.set(r.bookingId, [...(sentByBooking.get(r.bookingId) ?? []), r.kind]);
  const dueAppts = dueReminders(
    upcoming.map((b) => ({ bookingId: b.id, appointmentDate: b.appointmentDate, status: b.status, sentKinds: sentByBooking.get(b.id) ?? [] })),
    now,
  );
  let appointmentReminders = 0;
  for (const d of dueAppts) {
    const b = byId.get(d.bookingId);
    if (!b) continue;
    const to = b.patient.consentWhatsapp ? (b.patient.whatsapp ?? b.patient.phone) : null;
    if (to) {
      await dispatch(b.patientMrd, to, "appointment_reminder", `Reminder: appointment on ${b.appointmentDate.toISOString().slice(0, 10)} at ${b.startTime}`);
      await runAutomation("appointment_upcoming", { patientMrd: b.patientMrd, bookingId: b.id, to });
    }
    await prisma.appointmentReminder.create({ data: { bookingId: b.id, kind: d.kind, channel: "whatsapp", scheduledFor: now, sentAt: to ? now : null, status: to ? "sent" : "failed" } });
    appointmentReminders++;
  }

  return NextResponse.json({ ok: true, retention, remindersSent, birthdaysSent, annualReminders, slaEscalations, appointmentReminders, ranAt: new Date().toISOString() });
}

// Vercel Cron invokes via GET; manual/CI triggers may use POST.
export const GET = handle;
export const POST = handle;
