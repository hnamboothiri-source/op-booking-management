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

  let remindersSent = 0;
  for (const f of due) {
    const to = f.patient.consentWhatsapp ? (f.patient.whatsapp ?? f.patient.phone) : null;
    if (!to) continue;
    const res = await sendMessage({ channel: "whatsapp", to, template: "follow_up_reminder" });
    await prisma.communicationLog.create({
      data: {
        patientMrd: f.patientMrd,
        channel: "whatsapp",
        toAddress: to,
        body: "Follow-up reminder",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: res.status as any,
        sentAt: new Date(),
      },
    });
    remindersSent++;
  }

  return NextResponse.json({ ok: true, retention, remindersSent, ranAt: new Date().toISOString() });
}

// Vercel Cron invokes via GET; manual/CI triggers may use POST.
export const GET = handle;
export const POST = handle;
