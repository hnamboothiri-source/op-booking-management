"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runRetentionRecompute } from "./engine";
import { assertPlannedActivity } from "../planning/gate";
import { RETENTION_CONTACT_MODES, RETENTION_OUTCOMES, isReactivatedOutcome } from "@prm/core";
import { deliver } from "../communication/actions";
import { renderTemplate } from "@prm/core";

/**
 * Recompute retention for every patient (Module 12). Thin auth + audit wrapper
 * around the shared engine (also used by the daily cron job).
 */
export async function recomputeRetention(): Promise<void> {
  const user = await requireCan("retention", "edit");
  const result = await runRetentionRecompute();
  await writeAudit({ actorId: user.id, action: "retention.recompute", entity: "patient", after: result });
  revalidatePath("/retention");
}

export async function assignSuccessOwner(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("retention", "edit");
  const ownerId = fd.get("ownerId")?.toString() || null;
  await prisma.retentionStatus.update({ where: { patientMrd }, data: { successOwnerId: ownerId } });
  await writeAudit({ actorId: user.id, action: "retention.assign", entity: "patient", entityId: patientMrd });
  revalidatePath("/retention");
}

/** Record a reactivation outreach outcome (method + result required). A
 * booked / promised-visit result moves the patient to reactivated. */
export async function recordReactivation(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("retention", "edit");
  await assertPlannedActivity("retention", "reactivation_drive", fd.get("planRef")?.toString() || null);
  const method = fd.get("reactivationMethod")?.toString().trim() || null;
  const result = fd.get("reactivationResult")?.toString().trim() || null;
  const note = fd.get("reactivationNote")?.toString().trim() || null;
  if (!method || !result) throw new Error("Reactivation method and result are required");
  const reactivated = result === "booked" || result === "promised_visit";
  await prisma.retentionStatus.update({
    where: { patientMrd },
    data: {
      reactivationMethod: method, reactivationResult: result, reactivationNote: note, reactivatedAt: new Date(),
      ...(reactivated ? { category: "reactivated" } : {}),
    },
  });
  await writeAudit({ actorId: user.id, action: "retention.reactivation", entity: "patient", entityId: patientMrd, after: { method, result } });
  revalidatePath("/retention");
}

/**
 * Log ONE reactivation outreach attempt (RetentionActivity) + roll a successful
 * result onto RetentionStatus. The per-attempt log powers the patient profile
 * timeline, executive productivity and the reactivation funnel.
 */
export async function recordReactivationAttempt(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("retention", "edit");
  await assertPlannedActivity("retention", "reactivation_drive", fd.get("planRef")?.toString() || null);
  const contactMode = fd.get("contactMode")?.toString().trim() || "";
  const outcome = fd.get("outcome")?.toString().trim() || "";
  const remarks = fd.get("remarks")?.toString().trim() || null;
  const nextRaw = fd.get("nextContactDate")?.toString().trim() || "";
  const campaignId = fd.get("campaignId")?.toString().trim() || null;
  if (!RETENTION_CONTACT_MODES.includes(contactMode as (typeof RETENTION_CONTACT_MODES)[number])) throw new Error("Invalid contact mode");
  if (!RETENTION_OUTCOMES.includes(outcome as (typeof RETENTION_OUTCOMES)[number])) throw new Error("Invalid outcome");

  await prisma.retentionActivity.create({
    data: {
      patientMrd,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contactMode: contactMode as any,
      outcome,
      remarks,
      nextContactDate: nextRaw ? new Date(nextRaw) : null,
      actorId: user.id,
      campaignId,
    },
  });

  if (isReactivatedOutcome(outcome)) {
    await prisma.retentionStatus.update({
      where: { patientMrd },
      data: { category: "reactivated", reactivatedAt: new Date(), reactivationMethod: contactMode, reactivationResult: outcome, reactivationNote: remarks },
    });
  }
  await writeAudit({ actorId: user.id, action: "retention.attempt", entity: "patient", entityId: patientMrd, after: { contactMode, outcome } });
  revalidatePath("/retention");
  revalidatePath(`/retention/${patientMrd}`);
  revalidatePath("/retention/executives");
}

const segmentToCategory: Record<string, string> = { at_risk: "at_risk", dormant: "dormant", lost: "dormant" };

/**
 * Launch a reactivation campaign to a retention segment. Creates a real
 * `Campaign` row (tagged with a reactivation `program`), sends a template via
 * the chosen channel (consent-respecting), and logs a RetentionActivity +
 * CommunicationLog per patient — all carrying the campaign id so the campaign's
 * response funnel is traceable.
 */
export async function launchReactivationCampaign(fd: FormData): Promise<void> {
  const user = await requireCan("retention", "edit");
  await assertPlannedActivity("retention", "reactivation_drive", fd.get("planRef")?.toString() || null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channel = (fd.get("channel")?.toString() || "whatsapp") as any;
  const segment = fd.get("segment")?.toString() || "dormant";
  const program = fd.get("program")?.toString().trim() || "annual_wellness";
  const name = fd.get("name")?.toString().trim() || `${program.replace(/_/g, " ")} (${segment})`;
  const category = segmentToCategory[segment] ?? "dormant";
  const templateId = fd.get("templateId")?.toString().trim() || null;
  const template = templateId ? await prisma.communicationTemplate.findUnique({ where: { id: templateId } }) : null;

  // Campaign.type is the marketing-channel enum; map our channel onto it (else whatsapp).
  const campaignType = channel === "sms" || channel === "whatsapp" ? "whatsapp" : "whatsapp";
  const campaign = await prisma.campaign.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { name, type: campaignType as any, program, status: "running", launchedAt: new Date() },
  });
  const campaignId = campaign.id;

  const patients = await prisma.patient.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { category: category as any },
    take: 500,
  });
  let sent = 0;
  for (const p of patients) {
    const consentOk = channel === "whatsapp" ? p.consentWhatsapp : channel === "sms" ? p.consentSms : channel === "email" ? p.consentEmail : true;
    const to = channel === "whatsapp" ? p.whatsapp ?? p.phone : channel === "email" ? p.email : p.phone;
    if (!consentOk || !to) continue;
    const resolved = template?.body ? renderTemplate(template.body, { name: p.name, first_name: p.name.split(" ")[0], place: p.place ?? "", phone: p.phone ?? "" }) : null;
    await deliver(channel, to, template?.name ?? "reactivation", resolved, p.mrd, templateId, campaignId);
    await prisma.retentionActivity.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { patientMrd: p.mrd, contactMode: (channel === "whatsapp" || channel === "sms" || channel === "email" ? channel : "call") as any, outcome: "no_answer", remarks: `Campaign: ${name}`, actorId: user.id, campaignId },
    });
    sent++;
  }
  await writeAudit({ actorId: user.id, action: "retention.campaign", entity: "campaign", entityId: campaignId, after: { segment, program, channel, sent } });
  revalidatePath("/retention");
  revalidatePath("/retention/campaigns");
}

/** Save admin-tunable retention day-thresholds into the retention-rules CustomRecord. */
export async function saveRetentionRules(fd: FormData): Promise<void> {
  const user = await requireCan("retention", "edit");
  const atRiskDays = Number(fd.get("atRiskDays")) || 90;
  const dormantDays = Number(fd.get("dormantDays")) || 180;
  const lostDays = Number(fd.get("lostDays")) || 365;
  const data = { atRiskDays, dormantDays, lostDays };
  const existing = await prisma.customRecord.findFirst({ where: { moduleSlug: "retention", masterKey: "retention-rules" } });
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.customRecord.update({ where: { id: existing.id }, data: { data: data as any } });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.customRecord.create({ data: { moduleSlug: "retention", masterKey: "retention-rules", data: data as any } });
  }
  await writeAudit({ actorId: user.id, action: "retention.rules", entity: "custom_record", after: data });
  revalidatePath("/retention/reports");
  revalidatePath("/retention");
}
