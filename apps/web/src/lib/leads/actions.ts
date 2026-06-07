"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isClosedStage, type LeadStage } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

export async function createLead(fd: FormData): Promise<void> {
  const user = await requireCan("leads", "create");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  if (!contactName || !phone) throw new Error("Name and phone are required");

  const created = await prisma.lead.create({
    data: {
      contactName,
      phone,
      whatsapp: str(fd, "whatsapp"),
      email: str(fd, "email"),
      sourceId: str(fd, "sourceId"),
      campaignId: str(fd, "campaignId"),
      diseaseId: str(fd, "diseaseId"),
      branchId: str(fd, "branchId"),
      preferredDoctor: str(fd, "preferredDoctor"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: (str(fd, "priority") as any) ?? "medium",
      ownerId: str(fd, "ownerId") ?? user.id,
    },
  });

  // Automation: duplicate-mobile detection (master doc §10).
  const dup = await prisma.lead.findFirst({ where: { phone, id: { not: created.id } } });
  if (dup) await runAutomation("duplicate_mobile_detected", { leadId: created.id });

  await writeAudit({ actorId: user.id, action: "lead.create", entity: "lead", entityId: created.id, after: { contactName, phone } });
  revalidatePath("/leads");
  redirect(`/leads/${created.id}`);
}

export async function updateLeadStage(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("leads", "edit");
  const stage = fd.get("stage")?.toString() as LeadStage;
  const closureReason = str(fd, "closureReason");
  if (isClosedStage(stage) && !closureReason) throw new Error("A closure reason is required to close a lead");

  const before = await prisma.lead.findUnique({ where: { id } });
  await prisma.lead.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { stage: stage as any, closureReason: isClosedStage(stage) ? closureReason : null },
  });
  await writeAudit({ actorId: user.id, action: "lead.stage", entity: "lead", entityId: id, before: { stage: before?.stage }, after: { stage } });
  revalidatePath(`/leads/${id}`);
}

export async function transferLead(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("leads", "edit");
  const ownerId = fd.get("ownerId")?.toString() || null;
  const before = await prisma.lead.findUnique({ where: { id } });
  await prisma.lead.update({ where: { id }, data: { ownerId } });
  await writeAudit({ actorId: user.id, action: "lead.transfer", entity: "lead", entityId: id, before: { ownerId: before?.ownerId }, after: { ownerId } });
  revalidatePath(`/leads/${id}`);
}

export async function mergeLead(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("leads", "edit");
  const targetId = fd.get("targetId")?.toString().trim();
  if (!targetId || targetId === id) throw new Error("Pick a different target lead");
  const target = await prisma.lead.findUnique({ where: { id: targetId } });
  if (!target) throw new Error("Target lead not found");

  // Consolidate call history under the surviving lead, then mark this one merged.
  await prisma.$transaction([
    prisma.callLog.updateMany({ where: { leadId: id }, data: { leadId: targetId } }),
    prisma.lead.update({ where: { id }, data: { mergedIntoId: targetId, closureReason: "merged" } }),
  ]);
  await writeAudit({ actorId: user.id, action: "lead.merge", entity: "lead", entityId: id, after: { mergedIntoId: targetId } });
  revalidatePath("/leads");
  redirect(`/leads/${targetId}`);
}

export async function logCall(leadId: string, fd: FormData): Promise<void> {
  const user = await requireCan("calls", "create");
  const outcome = fd.get("outcome")?.toString() || "not_reachable";
  const notes = str(fd, "notes");
  const followUpDate = str(fd, "followUpDate");

  await prisma.callLog.create({
    data: {
      leadId,
      executiveId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outcome: outcome as any,
      notes,
    },
  });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastCallOutcome: outcome as any,
      stage: lead?.stage === "new_lead" ? "contacted" : lead?.stage,
      followUpDate: followUpDate ? new Date(followUpDate) : lead?.followUpDate,
    },
  });
  await writeAudit({ actorId: user.id, action: "call.log", entity: "lead", entityId: leadId, after: { outcome } });
  revalidatePath(`/leads/${leadId}`);
}
