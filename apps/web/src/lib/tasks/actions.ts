"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canTransition, type TaskStatus } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

export async function createTask(fd: FormData): Promise<void> {
  const user = await requireCan("tasks", "create");
  const type = fd.get("type")?.toString() || "call_back_patient";
  const subject = fd.get("subject")?.toString().trim();
  const assigneeId = fd.get("assigneeId")?.toString() || null;
  const priority = fd.get("priority")?.toString() || "medium";
  const dueRaw = fd.get("dueDate")?.toString();
  if (!subject) throw new Error("Subject is required");

  const created = await prisma.task.create({
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      subject,
      assigneeId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: priority as any,
      dueDate: dueRaw ? new Date(dueRaw) : null,
    },
  });
  await writeAudit({ actorId: user.id, action: "task.create", entity: "task", entityId: created.id, after: { subject, type } });
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function transitionTask(id: string, to: TaskStatus): Promise<void> {
  const user = await requireCan("tasks", "edit");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new Error("Task not found");
  const from = task.status as TaskStatus;
  if (!canTransition(from, to)) {
    throw new Error(`Illegal transition ${from} → ${to}`);
  }
  await prisma.task.update({
    where: { id },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: to as any,
      completedAt: to === "completed" ? new Date() : task.completedAt,
      escalatedToId: to === "escalated" ? task.escalatedToId : task.escalatedToId,
    },
  });
  await writeAudit({ actorId: user.id, action: "task.transition", entity: "task", entityId: id, before: { status: from }, after: { status: to } });
  revalidatePath("/tasks");
}
