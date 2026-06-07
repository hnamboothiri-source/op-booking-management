import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAutomation } from "@/lib/automation";

/**
 * IVR / call-centre telephony webhook (master doc §9 + M2). The phone system
 * POSTs a call event; we log it (matched to a lead/patient by phone), store any
 * recording, and fire the missed-call → callback-task automation.
 *
 * Body: { phone, status: "missed"|"answered", direction?, duration_sec?, recording_url? }
 * Auth: optional shared secret via IVR_SECRET (Authorization: Bearer / ?key=).
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.IVR_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return bearer === secret || req.nextUrl.searchParams.get("key") === secret;
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const phone = String(payload.phone ?? payload.from ?? "").trim();
  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 422 });
  const status = String(payload.status ?? "answered").toLowerCase();
  const missed = status === "missed" || status === "no-answer" || status === "no_answer";
  const durationSec = payload.duration_sec != null ? Number(payload.duration_sec) : null;
  const recordingUrl = payload.recording_url ? String(payload.recording_url) : null;

  // Match an existing lead (most recent) and/or patient by phone.
  const [lead, patient] = await Promise.all([
    prisma.lead.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } }),
    prisma.patient.findFirst({ where: { phone } }),
  ]);

  const call = await prisma.callLog.create({
    data: {
      leadId: lead?.id ?? null,
      patientMrd: patient?.mrd ?? null,
      // Inbound IVR events map to a coarse outcome for the call history.
      outcome: missed ? "not_reachable" : "follow_up_required",
      notes: `IVR ${status}${durationSec ? ` · ${durationSec}s` : ""}`,
      durationSec,
      recordingUrl,
    },
  });

  if (missed) {
    await runAutomation("missed_call_logged", { leadId: lead?.id ?? null, patientMrd: patient?.mrd ?? null, to: phone });
  }

  return NextResponse.json(
    { ok: true, callId: call.id, matchedLead: lead?.id ?? null, matchedPatient: patient?.mrd ?? null, missed },
    { status: 201 },
  );
}
