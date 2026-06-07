"use server";

import { revalidatePath } from "next/cache";
import { sendMessage, type Channel } from "@prm/integrations";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

/** Address for a channel (phone for whatsapp/sms, email for email). */
function addressFor(channel: Channel, p: { phone: string | null; whatsapp: string | null; email: string | null }): string | null {
  if (channel === "whatsapp") return p.whatsapp ?? p.phone;
  if (channel === "sms") return p.phone;
  if (channel === "email") return p.email;
  return p.phone;
}

function consentOk(channel: Channel, p: { consentWhatsapp: boolean; consentSms: boolean; consentEmail: boolean }): boolean {
  if (channel === "whatsapp") return p.consentWhatsapp;
  if (channel === "sms") return p.consentSms;
  if (channel === "email") return p.consentEmail;
  return true;
}

async function deliver(channel: Channel, to: string, templateName: string, body: string | null, patientMrd: string | null, templateId: string | null) {
  const res = await sendMessage({ channel, to, template: templateName, body: body ?? undefined });
  await prisma.communicationLog.create({
    data: {
      patientMrd,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel: channel as any,
      templateId,
      toAddress: to,
      body,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: res.status as any,
      sentAt: new Date(),
    },
  });
}

export async function sendOne(fd: FormData): Promise<void> {
  const user = await requireCan("communication", "create");
  const channel = (fd.get("channel")?.toString() || "whatsapp") as Channel;
  const patientMrd = str(fd, "patientMrd");
  const templateId = str(fd, "templateId");
  const body = str(fd, "body");

  const template = templateId ? await prisma.communicationTemplate.findUnique({ where: { id: templateId } }) : null;
  let to = str(fd, "to");
  if (patientMrd) {
    const p = await prisma.patient.findUnique({ where: { mrd: patientMrd } });
    if (!p) throw new Error("Patient not found");
    to = addressFor(channel, p);
  }
  if (!to) throw new Error("No address for this channel");

  await deliver(channel, to, template?.name ?? "adhoc", body ?? template?.body ?? null, patientMrd, templateId);
  await writeAudit({ actorId: user.id, action: "comm.send", entity: "communication_log", after: { channel, to } });
  revalidatePath("/communication");
}

/** Bulk/campaign send to a patient segment, respecting consent. */
export async function sendBulk(fd: FormData): Promise<void> {
  const user = await requireCan("communication", "create");
  const channel = (fd.get("channel")?.toString() || "whatsapp") as Channel;
  const category = fd.get("category")?.toString();
  const templateId = str(fd, "templateId");
  const template = templateId ? await prisma.communicationTemplate.findUnique({ where: { id: templateId } }) : null;

  const patients = await prisma.patient.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: category ? { category: category as any } : {},
    take: 500,
  });
  let sent = 0;
  for (const p of patients) {
    if (!consentOk(channel, p)) continue;
    const to = addressFor(channel, p);
    if (!to) continue;
    await deliver(channel, to, template?.name ?? "campaign", template?.body ?? null, p.mrd, templateId);
    sent++;
  }
  await writeAudit({ actorId: user.id, action: "comm.bulk", entity: "communication_log", after: { channel, category, sent } });
  revalidatePath("/communication");
}

export async function setConsent(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("patients", "edit");
  await prisma.patient.update({
    where: { mrd: patientMrd },
    data: {
      consentWhatsapp: fd.get("consentWhatsapp") === "on",
      consentSms: fd.get("consentSms") === "on",
      consentEmail: fd.get("consentEmail") === "on",
    },
  });
  await writeAudit({ actorId: user.id, action: "patient.consent", entity: "patient", entityId: patientMrd });
  revalidatePath(`/patients/${encodeURIComponent(patientMrd)}`);
}
