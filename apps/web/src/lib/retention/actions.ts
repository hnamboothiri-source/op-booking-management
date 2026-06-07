"use server";

import { revalidatePath } from "next/cache";
import { retentionScore, retentionCategory, riskFromRetention, monthsBetween } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

// retentionCategory → PatientCategory enum (no "lost" in patient category).
function patientCategoryFor(cat: string, repeat: boolean): string {
  if (cat === "active") return repeat ? "repeat_patient" : "new_patient";
  if (cat === "at_risk") return "at_risk";
  return "dormant"; // dormant | lost
}

/**
 * Recompute retention for every patient (Module 12): category from months since
 * last visit, an explainable retention score, risk, and a reactivation task for
 * dormant/lost patients. Idempotent — re-running refreshes scores.
 */
export async function recomputeRetention(): Promise<void> {
  const user = await requireCan("retention", "edit");
  const today = new Date(new Date().toISOString().slice(0, 10));
  const patients = await prisma.patient.findMany({ include: { _count: { select: { referralsGiven: true } } } });

  for (const p of patients) {
    const months = monthsBetween(p.lastVisitDate, today);
    const cat = retentionCategory(months);
    const rs = retentionScore({
      repeatVisit: p.lifetimeVisits > 1,
      followUpCompleted: false,
      referralGiven: p._count.referralsGiven > 0,
      missedFollowUp: false,
      monthsSinceLastVisit: months,
      admissionRejected: false,
    });
    const risk = riskFromRetention(rs.score);

    await prisma.retentionStatus.upsert({
      where: { patientMrd: p.mrd },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { category: cat as any, riskScore: risk, lastEvaluatedAt: new Date() },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { patientMrd: p.mrd, category: cat as any, riskScore: risk },
    });
    await prisma.patientScore.create({ data: { patientMrd: p.mrd, kind: "retention", score: rs.score, factors: rs.factors } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.patient.update({ where: { mrd: p.mrd }, data: { category: patientCategoryFor(cat, p.lifetimeVisits > 1) as any } });

    if (cat === "dormant" || cat === "lost") {
      const existing = await prisma.task.findFirst({
        where: { patientMrd: p.mrd, type: "contact_dormant_patient", status: { in: ["open", "in_progress", "escalated"] } },
      });
      if (!existing) {
        await prisma.task.create({ data: { type: "contact_dormant_patient", subject: `Reactivate ${p.name}`, patientMrd: p.mrd, priority: "medium" } });
      }
    }
  }

  await writeAudit({ actorId: user.id, action: "retention.recompute", entity: "patient", after: { count: patients.length } });
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
