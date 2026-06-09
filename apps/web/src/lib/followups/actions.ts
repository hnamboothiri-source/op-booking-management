"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deskForFollowUp, escalationTier, isConversionOutcome, isCompletedClosure, type CallDesk, type FollowUpOutcome } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";
import { assertPlannedActivity } from "../planning/gate";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const startOfToday = () => new Date(new Date().toISOString().slice(0, 10));
const daysOverdue = (due: Date) => Math.floor((startOfToday().getTime() - new Date(new Date(due).toISOString().slice(0, 10)).getTime()) / 86400000);

export async function createFollowUp(fd: FormData): Promise<void> {
  const user = await requireCan("follow_ups", "create");
  const patientMrd = str(fd, "patientMrd");
  const type = fd.get("type")?.toString() || "consultation_review";
  const dueDate = str(fd, "dueDate");
  if (!patientMrd || !dueDate) throw new Error("Patient MRD and due date are required");
  const planRef = str(fd, "planRef");
  await assertPlannedActivity("follow-ups", "followup_drive", planRef);

  const created = await prisma.followUp.create({
    data: {
      patientMrd,
      planRef,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      dueDate: new Date(dueDate),
      doctorId: str(fd, "doctorId"),
      ownerId: str(fd, "ownerId") ?? user.id,
      notes: str(fd, "notes"),
      desk: deskForFollowUp(),
    },
  });
  await writeAudit({ actorId: user.id, action: "followup.create", entity: "follow_up", entityId: created.id, after: { type } });
  revalidatePath("/follow-ups");
  redirect("/follow-ups");
}

/** Re-route a follow-up to a different desk. */
export async function routeFollowUpToDesk(id: string, desk: CallDesk): Promise<void> {
  const user = await requireCan("follow_ups", "edit");
  await prisma.followUp.update({ where: { id }, data: { desk } });
  await writeAudit({ actorId: user.id, action: "followup.route_desk", entity: "follow_up", entityId: id, after: { desk } });
  revalidatePath("/front-office");
}

export async function transitionFollowUp(id: string, status: string): Promise<void> {
  const user = await requireCan("follow_ups", "edit");
  const fu = await prisma.followUp.findUnique({ where: { id } });
  if (!fu) throw new Error("Follow-up not found");
  await prisma.followUp.update({
    where: { id },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: status as any,
      closureReason: status === "done" ? "completed" : fu.closureReason,
      completedAt: status === "done" ? new Date() : status === "missed" ? fu.completedAt : null,
    },
  });
  if (status === "missed") await runAutomation("follow_up_missed", { patientMrd: fu.patientMrd });
  await writeAudit({ actorId: user.id, action: "followup.transition", entity: "follow_up", entityId: id, before: { status: fu.status }, after: { status } });
  revalidatePath("/follow-ups");
}

const revalidateFu = (id: string) => { revalidatePath(`/follow-ups/${id}`); revalidatePath("/follow-ups"); };

/** Record a contact attempt + outcome (FollowUpActivity) and advance the follow-up. */
export async function recordFollowUpOutcome(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("follow_ups", "edit");
  const fu = await prisma.followUp.findUnique({ where: { id } });
  if (!fu) throw new Error("Follow-up not found");
  const outcome = (str(fd, "outcome") ?? "will_call_back") as FollowUpOutcome;
  const nextDate = str(fd, "nextFollowUpDate");
  const nextAction = str(fd, "nextAction");
  await prisma.followUpActivity.create({
    data: {
      followUpId: id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contactMode: (str(fd, "contactMode") ?? "call") as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outcome: outcome as any,
      remarks: str(fd, "remarks"),
      nextFollowUpDate: nextDate ? new Date(nextDate) : null,
      nextAction,
      actorId: user.id,
    },
  });
  // Advance the follow-up from the outcome.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { nextAction: nextAction ?? fu.nextAction };
  if (isConversionOutcome(outcome)) data.status = "booked";
  if (nextDate) { data.dueDate = new Date(nextDate); data.status = "pending"; data.escalationLevel = 0; }
  await prisma.followUp.update({ where: { id }, data });
  await writeAudit({ actorId: user.id, action: "followup.outcome", entity: "follow_up", entityId: id, after: { outcome } });
  revalidateFu(id);
}

/** Reschedule a follow-up to a new date with a reason; clears escalation. */
export async function rescheduleFollowUp(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("follow_ups", "edit");
  const newDate = str(fd, "dueDate");
  if (!newDate) throw new Error("New due date is required");
  const reason = str(fd, "reason");
  await prisma.followUp.update({ where: { id }, data: { dueDate: new Date(newDate), status: "pending", escalationLevel: 0 } });
  await prisma.followUpActivity.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { followUpId: id, contactMode: "call" as any, outcome: "call_later" as any, remarks: reason ? `Rescheduled: ${reason}` : "Rescheduled", nextFollowUpDate: new Date(newDate), actorId: user.id },
  });
  await writeAudit({ actorId: user.id, action: "followup.reschedule", entity: "follow_up", entityId: id, after: { newDate, reason } });
  revalidateFu(id);
}

/** Close a follow-up with a reason (done when completed, else cancelled). */
export async function closeFollowUp(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("follow_ups", "edit");
  const reason = str(fd, "closureReason") ?? "no_followup_needed";
  await prisma.followUp.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: (isCompletedClosure(reason) ? "done" : "cancelled") as any, closureReason: reason, completedAt: new Date() },
  });
  await writeAudit({ actorId: user.id, action: "followup.close", entity: "follow_up", entityId: id, after: { reason } });
  revalidateFu(id);
}

/** Escalation engine: flip overdue + escalate open follow-ups by SLA tier (button-triggered). */
export async function runFollowUpEscalation(): Promise<void> {
  const user = await requireCan("follow_ups", "edit");
  const manager = (await prisma.staffUser.findFirst({ where: { role: { in: ["administrator", "management"] } } })) ?? (await prisma.staffUser.findFirst({ where: { active: true } }));
  const open = await prisma.followUp.findMany({ where: { status: { in: ["pending", "booked"] }, dueDate: { lt: startOfToday() } } });
  let escalated = 0;
  for (const fu of open) {
    const tier = escalationTier(daysOverdue(fu.dueDate));
    if (tier.level <= (fu.escalationLevel ?? 0)) continue;
    await prisma.followUp.update({ where: { id: fu.id }, data: { status: "overdue", escalationLevel: tier.level } });
    await prisma.followUpEscalation.create({ data: { followUpId: fu.id, level: tier.level, escalatedToId: manager?.id ?? null, reason: `Overdue ${daysOverdue(fu.dueDate)}d → ${tier.notify}` } });
    await prisma.task.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { type: "call_back_patient" as any, subject: `Escalated follow-up (L${tier.level}) · ${fu.type.replace(/_/g, " ")}`, patientMrd: fu.patientMrd, followUpId: fu.id, assigneeId: manager?.id ?? null, priority: "urgent", status: "escalated", dueDate: fu.dueDate },
    });
    escalated++;
  }
  await writeAudit({ actorId: user.id, action: "followup.escalation.run", entity: "follow_up", after: { escalated } });
  revalidatePath("/follow-ups/escalations");
  revalidatePath("/follow-ups");
}
