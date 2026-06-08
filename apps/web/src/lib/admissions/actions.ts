"use server";

import { revalidatePath } from "next/cache";
import { canTransitionAdmission, admissionNeedsReason, isAdmissionTerminal, type AdmissionStatus } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

export async function transitionAdmission(id: string, to: AdmissionStatus, fd: FormData): Promise<void> {
  const user = await requireCan("admissions", "edit");
  const rec = await prisma.admissionRecommendation.findUnique({ where: { id } });
  if (!rec) throw new Error("Admission recommendation not found");
  const from = rec.status as AdmissionStatus;
  if (!canTransitionAdmission(from, to)) throw new Error(`Illegal transition ${from} → ${to}`);

  const reason = fd.get("rejectionReason")?.toString();
  if (admissionNeedsReason(to) && !reason) throw new Error("A reason is required to reject/close an admission");

  const counsellingNotes = fd.get("counsellingNotes")?.toString().trim() || null;
  if (to === "counselled" && !counsellingNotes) throw new Error("Counselling notes are required when counselling a patient");
  const costRupees = fd.get("costDiscussed")?.toString().trim();
  const nextAt = fd.get("nextCounsellingAt")?.toString().trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { status: to };
  if (to === "counselled") {
    data.counsellorId = user.id;
    data.counsellingNotes = counsellingNotes;
    if (costRupees) data.costDiscussed = Math.round(parseFloat(costRupees) * 100);
    if (nextAt) data.nextCounsellingAt = new Date(nextAt);
  }
  if (isAdmissionTerminal(to)) data.decisionAt = new Date();
  if (admissionNeedsReason(to)) data.rejectionReason = reason;

  await prisma.admissionRecommendation.update({ where: { id }, data });
  await writeAudit({ actorId: user.id, action: "admission.transition", entity: "admission_recommendation", entityId: id, before: { status: from }, after: { status: to, reason } });
  revalidatePath("/admissions");
}
