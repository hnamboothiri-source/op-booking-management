"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runRetentionRecompute } from "./engine";

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
