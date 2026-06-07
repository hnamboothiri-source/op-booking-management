import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@prm/integrations";
import { prisma } from "@/lib/db";
import { runRetentionRecompute } from "@/lib/retention/engine";

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

  return NextResponse.json({ ok: true, retention, remindersSent, birthdaysSent, annualReminders, ranAt: new Date().toISOString() });
}

// Vercel Cron invokes via GET; manual/CI triggers may use POST.
export const GET = handle;
export const POST = handle;
