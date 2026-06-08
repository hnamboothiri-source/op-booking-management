"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deskForFollowUp, type CallDesk } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

export async function createFollowUp(fd: FormData): Promise<void> {
  const user = await requireCan("follow_ups", "create");
  const patientMrd = str(fd, "patientMrd");
  const type = fd.get("type")?.toString() || "consultation_review";
  const dueDate = str(fd, "dueDate");
  if (!patientMrd || !dueDate) throw new Error("Patient MRD and due date are required");

  const created = await prisma.followUp.create({
    data: {
      patientMrd,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: status as any, closureReason: status === "done" ? "completed" : fu.closureReason },
  });
  if (status === "missed") await runAutomation("follow_up_missed", { patientMrd: fu.patientMrd });
  await writeAudit({ actorId: user.id, action: "followup.transition", entity: "follow_up", entityId: id, before: { status: fu.status }, after: { status } });
  revalidatePath("/follow-ups");
}
