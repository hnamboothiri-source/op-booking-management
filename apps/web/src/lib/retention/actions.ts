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

export async function markReactivated(patientMrd: string): Promise<void> {
  const user = await requireCan("retention", "edit");
  await prisma.retentionStatus.update({ where: { patientMrd }, data: { category: "reactivated" } });
  await writeAudit({ actorId: user.id, action: "retention.reactivated", entity: "patient", entityId: patientMrd });
  revalidatePath("/retention");
}
