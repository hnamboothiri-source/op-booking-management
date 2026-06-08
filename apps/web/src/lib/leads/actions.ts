"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isClosedStage, deskForSource, nextLeadNumber, routeLeadOwner, type LeadStage, type CallDesk, type LeadActivityKind } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";
import { ASSIGNMENT_RULES, ASSIGNMENT_FALLBACK } from "./assignment-rules";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const bool = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString();
  return v === "yes" || v === "true" || v === "on" ? true : v === "no" || v === "false" ? false : null;
};

/** Append an entry to a lead's activity timeline (best-effort). */
export async function writeLeadActivity(a: { leadId: string; kind: LeadActivityKind; summary: string; detail?: string | null; actorId?: string | null }): Promise<void> {
  try {
    await prisma.leadActivity.create({ data: { leadId: a.leadId, kind: a.kind, summary: a.summary, detail: a.detail ?? null, actorId: a.actorId ?? null } });
  } catch {
    // timeline is non-critical; never block the primary action
  }
}

export interface DuplicateMatch { type: "lead" | "patient"; id: string; name: string; sub: string; href: string }

/** Find possible existing records by phone / whatsapp / email (FRS §7). */
export async function findDuplicates(phone?: string | null, whatsapp?: string | null, email?: string | null): Promise<DuplicateMatch[]> {
  await requireCan("leads", "view");
  const phones = [phone, whatsapp].map((p) => p?.trim()).filter(Boolean) as string[];
  const mail = email?.trim() || null;
  const out: DuplicateMatch[] = [];

  if (phones.length || mail) {
    const or: Record<string, unknown>[] = [];
    if (phones.length) { or.push({ phone: { in: phones } }, { whatsapp: { in: phones } }); }
    if (mail) or.push({ email: mail });
    const leads = await prisma.lead.findMany({ where: { OR: or, mergedIntoId: null } as never, include: { source: true }, take: 5 });
    for (const l of leads) out.push({ type: "lead", id: l.id, name: l.contactName, sub: `${l.leadNumber ?? "lead"} · ${l.stage.replace(/_/g, " ")}`, href: `/leads/${l.id}` });

    const pOr: Record<string, unknown>[] = [];
    if (phones.length) pOr.push({ phone: { in: phones } }, { whatsapp: { in: phones } });
    if (mail) pOr.push({ email: mail });
    const patients = await prisma.patient.findMany({ where: { OR: pOr } as never, take: 5 });
    for (const p of patients) out.push({ type: "patient", id: p.mrd, name: p.name, sub: `MRD ${p.mrd}${p.lastVisitDate ? " · last visit " + new Date(p.lastVisitDate).toISOString().slice(0, 10) : ""}`, href: `/patients/${encodeURIComponent(p.mrd)}` });
  }
  return out;
}

export async function createLead(fd: FormData): Promise<void> {
  const user = await requireCan("leads", "create");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  if (!contactName || !phone) throw new Error("Name and phone are required");

  // Auto-route to a call-centre desk by the lead's source (Reception vs Back Office).
  const sourceId = str(fd, "sourceId");
  const source = sourceId ? await prisma.leadSourceMaster.findUnique({ where: { id: sourceId } }) : null;
  const desk = str(fd, "desk") ?? deskForSource(source?.name ?? null);

  // Owner: explicit choice wins; otherwise run the auto-assignment engine
  // (FRS §5) over branch / disease / source-group signals.
  const branchId = str(fd, "branchId");
  const diseaseId = str(fd, "diseaseId");
  const explicitOwner = str(fd, "ownerId");
  const routed = routeLeadOwner({ branchId, diseaseId, sourceGroup: source?.group ?? null }, ASSIGNMENT_RULES, ASSIGNMENT_FALLBACK);
  const ownerId = explicitOwner ?? routed.ownerId ?? user.id;
  const assignReason = explicitOwner ? "manual selection" : routed.reason;

  // Human-facing lead number derived from the current row count (mock-safe).
  const seq = (await prisma.lead.count()) + 1;
  const leadNumber = nextLeadNumber(seq, new Date().getFullYear());

  const created = await prisma.lead.create({
    data: {
      leadNumber,
      contactName,
      phone,
      whatsapp: str(fd, "whatsapp"),
      email: str(fd, "email"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gender: (str(fd, "gender") as any) ?? null,
      age: num(fd, "age"),
      city: str(fd, "city"),
      district: str(fd, "district"),
      chiefComplaint: str(fd, "chiefComplaint"),
      previousTreatment: bool(fd, "previousTreatment"),
      existingPatient: bool(fd, "existingPatient"),
      sourceId,
      secondarySource: str(fd, "secondarySource") ?? source?.name ?? null,
      campaignId: str(fd, "campaignId"),
      diseaseId: str(fd, "diseaseId"),
      branchId: str(fd, "branchId"),
      preferredDoctor: str(fd, "preferredDoctor"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: (str(fd, "priority") as any) ?? "medium",
      priorityTier: str(fd, "priorityTier"),
      ownerId,
      assignedAt: ownerId ? new Date() : null,
      desk,
    },
  });

  await writeLeadActivity({ leadId: created.id, kind: "created", summary: `Lead created${source ? " from " + source.name.replace(/_/g, " ") : ""}`, actorId: user.id });
  if (ownerId) {
    await writeLeadActivity({ leadId: created.id, kind: "assigned", summary: `Assigned (${assignReason})`, actorId: user.id });
    try {
      await prisma.leadAssignment.create({ data: { leadId: created.id, fromOwnerId: null, toOwnerId: ownerId, toBranchId: branchId, reason: assignReason, actorId: user.id } });
    } catch { /* history is non-critical */ }
  }

  // Automation: duplicate-mobile detection (master doc §10). Skipped when the
  // user already acknowledged duplicates and chose "continue as new" (force).
  if (str(fd, "force") !== "true") {
    const dup = await prisma.lead.findFirst({ where: { phone, id: { not: created.id } } });
    if (dup) await runAutomation("duplicate_mobile_detected", { leadId: created.id });
  }

  await writeAudit({ actorId: user.id, action: "lead.create", entity: "lead", entityId: created.id, after: { contactName, phone, leadNumber } });
  revalidatePath("/leads");
  redirect(`/leads/${created.id}`);
}

/**
 * Log a missed call as a lead (FRS §12). Creates a reception lead flagged
 * missedEnquiry and fires the missed_call_logged automation (callback task).
 */
export async function logMissedCall(fd: FormData): Promise<void> {
  const user = await requireCan("leads", "create");
  const phone = str(fd, "phone");
  if (!phone) throw new Error("Phone is required");
  const seq = (await prisma.lead.count()) + 1;
  const created = await prisma.lead.create({
    data: {
      leadNumber: nextLeadNumber(seq, new Date().getFullYear()),
      contactName: str(fd, "contactName") ?? "Missed call",
      phone,
      missedEnquiry: true,
      desk: "reception",
      ownerId: user.id,
      assignedAt: new Date(),
    },
  });
  await writeLeadActivity({ leadId: created.id, kind: "created", summary: "Missed call logged", actorId: user.id });
  await runAutomation("missed_call_logged", { leadId: created.id });
  await writeAudit({ actorId: user.id, action: "lead.missed_call", entity: "lead", entityId: created.id, after: { phone } });
  revalidatePath("/reception");
  revalidatePath("/leads");
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
  await writeLeadActivity({ leadId: id, kind: "stage_change", summary: `Stage → ${stage.replace(/_/g, " ")}`, detail: closureReason, actorId: user.id });
  await writeAudit({ actorId: user.id, action: "lead.stage", entity: "lead", entityId: id, before: { stage: before?.stage }, after: { stage } });
  revalidatePath(`/leads/${id}`);
}

export async function transferLead(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("leads", "edit");
  const ownerId = fd.get("ownerId")?.toString() || null;
  const branchId = fd.get("branchId")?.toString() || undefined; // optional branch transfer
  const reason = str(fd, "reason");
  const before = await prisma.lead.findUnique({ where: { id } });
  const data: Record<string, unknown> = { ownerId, assignedAt: new Date() };
  if (branchId !== undefined && branchId !== "") data.branchId = branchId;
  await prisma.lead.update({ where: { id }, data });

  // Record the assignment/transfer in history.
  await prisma.leadAssignment.create({
    data: {
      leadId: id, fromOwnerId: before?.ownerId ?? null, toOwnerId: ownerId,
      fromBranchId: before?.branchId ?? null, toBranchId: (data.branchId as string) ?? before?.branchId ?? null,
      reason: reason ?? "manual transfer", actorId: user.id,
    },
  });
  await writeLeadActivity({ leadId: id, kind: "transfer", summary: "Lead transferred", detail: reason, actorId: user.id });
  await writeAudit({ actorId: user.id, action: "lead.transfer", entity: "lead", entityId: id, before: { ownerId: before?.ownerId }, after: { ownerId, branchId: data.branchId } });
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
  await writeLeadActivity({ leadId: targetId, kind: "merge", summary: `Merged in lead ${id}`, actorId: user.id });
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
      lastContactAt: new Date(),
      stage: lead?.stage === "new_lead" ? "contacted" : lead?.stage,
      followUpDate: followUpDate ? new Date(followUpDate) : lead?.followUpDate,
    },
  });
  await writeAudit({ actorId: user.id, action: "call.log", entity: "lead", entityId: leadId, after: { outcome } });
  revalidatePath(`/leads/${leadId}`);
}

/** Re-route a lead to a different call-centre desk. */
export async function routeLeadToDesk(leadId: string, desk: CallDesk): Promise<void> {
  const user = await requireCan("leads", "edit");
  await prisma.lead.update({ where: { id: leadId }, data: { desk } });
  await writeAudit({ actorId: user.id, action: "lead.route_desk", entity: "lead", entityId: leadId, after: { desk } });
  revalidatePath("/reception");
  revalidatePath("/back-office");
}

/** Escalate a lead to a manager — creates an urgent escalated task referencing it. */
export async function escalateLead(leadId: string): Promise<void> {
  const user = await requireCan("leads", "edit");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  const created = await prisma.task.create({
    data: {
      type: "call_back_patient",
      subject: `[escalated] Lead ${lead?.contactName ?? leadId}`,
      leadId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: "escalated" as any,
      priority: "urgent",
    },
  });
  await writeAudit({ actorId: user.id, action: "lead.escalate", entity: "lead", entityId: leadId, after: { taskId: created.id } });
  revalidatePath("/call-center");
}
