"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { writeLeadActivity } from "../leads/actions";
import { runAutomation } from "../automation";
import { checklistAnswered, type ChecklistAnswer } from "@prm/core";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

/**
 * Record a structured call with the desk's checklist (Module 2). Handles both
 * lead calls (Reception / Back Office) and patient follow-up review calls
 * (Front Office), keyed by hidden leadId | (patientMrd + followUpId) + desk.
 * Snapshots the ticked checklist onto CallLog.checklistJson and validates that
 * every mandatory item was answered.
 */
export async function recordCall(fd: FormData): Promise<void> {
  const user = await requireCan("calls", "create");
  const leadId = str(fd, "leadId");
  const patientMrd = str(fd, "patientMrd");
  const followUpId = str(fd, "followUpId");
  const desk = str(fd, "desk");
  const outcome = fd.get("outcome")?.toString() || "follow_up_required";
  const notes = str(fd, "notes");
  const nextAction = str(fd, "nextAction");
  const followUpDate = str(fd, "followUpDate");
  const durationMin = str(fd, "durationMin");
  const fuStatus = str(fd, "status"); // follow-up calls only

  // Re-query the submitted checklist items to snapshot label + responseType.
  const itemIds = (str(fd, "itemIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const items = itemIds.length
    ? await prisma.callChecklistItem.findMany({ where: { id: { in: itemIds } } })
    : [];
  const answers: ChecklistAnswer[] = items.map((it) => {
    const responseType = (it.responseType as string) ?? "checkbox";
    const checked = responseType === "checkbox" ? fd.get(`done_${it.id}`) != null : undefined;
    const value = responseType === "checkbox" ? undefined : str(fd, `value_${it.id}`);
    return { itemId: String(it.id), label: String(it.label), responseType, checked, value, note: str(fd, `note_${it.id}`) };
  });

  // Enforce mandatory items.
  const missing = items.filter((it) => it.mandatory && !checklistAnswered(answers.find((a) => a.itemId === it.id)!));
  if (missing.length) throw new Error(`Complete the mandatory checklist items: ${missing.map((m) => m.label).join(", ")}`);

  const durationSec = durationMin ? Math.round(parseFloat(durationMin) * 60) : null;
  const checklistJson = answers.length ? JSON.stringify(answers) : null;

  await prisma.callLog.create({
    data: {
      leadId, patientMrd, followUpId, desk,
      executiveId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outcome: outcome as any,
      notes, nextAction, checklistJson, durationSec,
    },
  });

  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lastCallOutcome: outcome as any,
        lastContactAt: new Date(),
        stage: lead?.stage === "new_lead" ? "contacted" : lead?.stage,
        followUpDate: followUpDate ? new Date(followUpDate) : lead?.followUpDate,
      },
    });
    await writeLeadActivity({ leadId, kind: "call", summary: `Call — ${outcome.replace(/_/g, " ")}`, detail: notes, actorId: user.id });
  }

  if (followUpId) {
    await prisma.followUp.update({
      where: { id: followUpId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { callOutcome: outcome as any, notes: notes ?? undefined, ...(fuStatus ? { status: fuStatus as any, closureReason: fuStatus === "done" ? "completed" : undefined } : {}) },
    });
    if (fuStatus === "missed" && patientMrd) await runAutomation("follow_up_missed", { patientMrd });
  }

  await writeAudit({ actorId: user.id, action: "call.record", entity: leadId ? "lead" : "follow_up", entityId: leadId ?? followUpId ?? patientMrd ?? "", after: { outcome, desk } });

  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (followUpId) revalidatePath(`/follow-ups/${followUpId}`);
  redirect(leadId ? `/leads/${leadId}` : "/follow-ups");
}
