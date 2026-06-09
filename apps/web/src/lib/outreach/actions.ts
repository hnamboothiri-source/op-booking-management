"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  rupeesToPaise,
  PLANNING_STEPS,
  isActionableRisk,
  type ScreeningRisk,
  type OutreachExpenseLine,
  type OutreachStaffLine,
  type OutreachRevenueLine,
  type PlanningChecklist,
} from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { assertPlannedActivity } from "../planning/gate";
import type { OutreachEventType } from "./metrics";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

async function sourceId(name: string): Promise<string | null> {
  const s = await prisma.leadSourceMaster.findUnique({ where: { name } });
  return s?.id ?? null;
}

// ---------------- Shared event helpers (camp / mobile clinic) ----------------

interface EventCfg {
  resource: "camps" | "mobile_clinics";
  path: (id: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: () => any;
}
function cfg(t: OutreachEventType): EventCfg {
  return t === "camp"
    ? { resource: "camps", path: (id) => `/camps/${id}`, model: () => prisma.camp }
    : { resource: "mobile_clinics", path: (id) => `/mobile-clinics/${id}`, model: () => prisma.mobileClinic };
}

/** Read an event, mutate one of its JSON arrays/objects, write it back + audit. */
async function mutateEvent(
  t: OutreachEventType,
  id: string,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: (ev: any) => Record<string, unknown>,
): Promise<void> {
  const c = cfg(t);
  const user = await requireCan(c.resource, "edit");
  const ev = await c.model().findUnique({ where: { id } });
  if (!ev) throw new Error("Outreach event not found");
  await c.model().update({ where: { id }, data: patch(ev) });
  await writeAudit({ actorId: user.id, action, entity: t === "camp" ? "camp" : "mobile_clinic", entityId: id });
  revalidatePath(c.path(id));
}

// ---------------- Budget / roster / revenue / planning ----------------

export async function saveBudgetLine(t: OutreachEventType, id: string, fd: FormData): Promise<void> {
  await mutateEvent(t, id, "outreach.budget", (ev) => {
    const list: OutreachExpenseLine[] = Array.isArray(ev.expenses) ? [...ev.expenses] : [];
    const line: OutreachExpenseLine = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: (str(fd, "category") as any) ?? "misc",
      planned: rupeesToPaise(str(fd, "planned")),
      actual: str(fd, "actual") != null ? rupeesToPaise(str(fd, "actual")) : null,
      note: str(fd, "note"),
    };
    const idx = num(fd, "index");
    if (idx != null && idx >= 0 && idx < list.length) list[idx] = line;
    else list.push(line);
    return { expenses: list };
  });
}

export async function removeBudgetLine(t: OutreachEventType, id: string, index: number): Promise<void> {
  await mutateEvent(t, id, "outreach.budget.remove", (ev) => {
    const list: OutreachExpenseLine[] = Array.isArray(ev.expenses) ? [...ev.expenses] : [];
    if (index >= 0 && index < list.length) list.splice(index, 1);
    return { expenses: list };
  });
}

export async function saveStaffLine(t: OutreachEventType, id: string, fd: FormData): Promise<void> {
  await mutateEvent(t, id, "outreach.roster", (ev) => {
    const list: OutreachStaffLine[] = Array.isArray(ev.staffRoster) ? [...ev.staffRoster] : [];
    list.push({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: (str(fd, "role") as any) ?? "attender",
      name: str(fd, "name"),
      staffId: str(fd, "staffId"),
      honorarium: rupeesToPaise(str(fd, "honorarium")),
    });
    return { staffRoster: list };
  });
}

export async function removeStaffLine(t: OutreachEventType, id: string, index: number): Promise<void> {
  await mutateEvent(t, id, "outreach.roster.remove", (ev) => {
    const list: OutreachStaffLine[] = Array.isArray(ev.staffRoster) ? [...ev.staffRoster] : [];
    if (index >= 0 && index < list.length) list.splice(index, 1);
    return { staffRoster: list };
  });
}

export async function saveRevenueLine(t: OutreachEventType, id: string, fd: FormData): Promise<void> {
  await mutateEvent(t, id, "outreach.revenue", (ev) => {
    const list: OutreachRevenueLine[] = Array.isArray(ev.revenueLines) ? [...ev.revenueLines] : [];
    list.push({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kind: (str(fd, "kind") as any) ?? "other",
      amount: rupeesToPaise(str(fd, "amount")),
      note: str(fd, "note"),
    });
    return { revenueLines: list };
  });
}

export async function removeRevenueLine(t: OutreachEventType, id: string, index: number): Promise<void> {
  await mutateEvent(t, id, "outreach.revenue.remove", (ev) => {
    const list: OutreachRevenueLine[] = Array.isArray(ev.revenueLines) ? [...ev.revenueLines] : [];
    if (index >= 0 && index < list.length) list.splice(index, 1);
    return { revenueLines: list };
  });
}

export async function updatePlanning(t: OutreachEventType, id: string, fd: FormData): Promise<void> {
  await mutateEvent(t, id, "outreach.planning", () => {
    const planning: PlanningChecklist = {};
    for (const step of PLANNING_STEPS) planning[step.key] = fd.get(step.key) === "on";
    return { planning };
  });
}

/** Upsert a single expense category's planned amount in the JSON list. */
function upsertPlanned(list: OutreachExpenseLine[], category: OutreachExpenseLine["category"], planned: number): OutreachExpenseLine[] {
  const next = [...list];
  const i = next.findIndex((e) => e.category === category);
  if (i >= 0) next[i] = { ...next[i], planned };
  else next.push({ category, planned, actual: null });
  return next;
}

/** Edit the core "camp plan" fields + the budgeted rent / ad spend (point 1,2,6a,6b,6d,6h). */
export async function updateCampPlan(t: OutreachEventType, id: string, fd: FormData): Promise<void> {
  await mutateEvent(t, id, "outreach.plan", (ev) => {
    let expenses: OutreachExpenseLine[] = Array.isArray(ev.expenses) ? [...ev.expenses] : [];
    const rent = str(fd, "rentBudget");
    const ads = str(fd, "adBudget");
    if (rent != null) expenses = upsertPlanned(expenses, "venue_rent", rupeesToPaise(rent));
    if (ads != null) expenses = upsertPlanned(expenses, "marketing_ads", rupeesToPaise(ads));
    return {
      location: str(fd, "location"),
      venue: str(fd, "venue"),
      venueCapacity: num(fd, "venueCapacity"),
      diseaseId: str(fd, "diseaseId"),
      branchId: str(fd, "branchId"),
      isRecurring: fd.get("isRecurring") === "on",
      expectedPatients: num(fd, "expectedPatients"),
      expectedAdmissions: num(fd, "expectedAdmissions"),
      expenses,
    };
  });
}

/** Point 6c — pull existing patients in the locality and create camp-visit follow-ups. */
export async function inviteLocalPatients(t: OutreachEventType, id: string): Promise<void> {
  const c = cfg(t);
  const user = await requireCan(c.resource, "edit");
  const ev = await c.model().findUnique({ where: { id } });
  if (!ev) throw new Error("Outreach event not found");
  const place = (ev.location ?? "").trim();
  if (!place) throw new Error("Set the camp location first");

  const patients = await prisma.patient.findMany({ where: { place: { contains: place, mode: "insensitive" } } });
  const due = ev.scheduledAt ? new Date(ev.scheduledAt) : new Date(new Date().toISOString().slice(0, 10));
  let invited = 0;
  for (const p of patients) {
    await prisma.followUp.create({
      data: {
        patientMrd: p.mrd,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: "annual_checkup" as any,
        dueDate: due,
        ownerId: user.id,
        desk: "front_office",
        notes: `Camp visit · ${ev.name ?? ev.routeName} · ${place}`,
      },
    });
    invited += 1;
  }
  const planning: PlanningChecklist = { ...(ev.planning ?? {}), existingPatientsContacted: invited > 0 };
  await c.model().update({ where: { id }, data: { planning } });
  await writeAudit({ actorId: user.id, action: "outreach.invite_local", entity: t === "camp" ? "camp" : "mobile_clinic", entityId: id, after: { invited } });
  revalidatePath(c.path(id));
}

// ---------------- Camps (M7) ----------------

export async function createCamp(fd: FormData): Promise<void> {
  const user = await requireCan("camps", "create");
  const name = str(fd, "name");
  if (!name) throw new Error("Camp name is required");
  const planRef = str(fd, "planRef");
  await assertPlannedActivity("camps", "conduct_camp", planRef);
  const scheduledAt = str(fd, "scheduledAt");
  const created = await prisma.camp.create({
    data: {
      name,
      planRef,
      location: str(fd, "location"),
      branchId: str(fd, "branchId"),
      diseaseId: str(fd, "diseaseId"),
      organizerId: str(fd, "organizerId"),
      coordinatorId: user.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      isRecurring: fd.get("isRecurring") === "on",
      expectedPatients: num(fd, "expectedPatients"),
    },
  });
  await writeAudit({ actorId: user.id, action: "camp.create", entity: "camp", entityId: created.id });
  revalidatePath("/camps");
  redirect(`/camps/${created.id}`);
}

export async function addCampPatient(campId: string, fd: FormData): Promise<void> {
  const user = await requireCan("camps", "edit");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  if (!contactName) throw new Error("Patient name is required");
  const riskCategory = (str(fd, "riskCategory") ?? "normal") as ScreeningRisk;
  const recommendedVisit = isActionableRisk(riskCategory);
  const screenedById = str(fd, "screenedById") ?? user.id;

  const cp = await prisma.$transaction(async (tx) => {
    const created = await tx.campPatient.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { campId, contactName, phone, age: num(fd, "age"), gender: (str(fd, "gender") as any) ?? null, diseaseId: str(fd, "diseaseId"), complaint: str(fd, "complaint"), riskCategory: riskCategory as any, screenedById, recommendedVisit },
    });
    await tx.camp.update({ where: { id: campId }, data: { patientsScreened: { increment: 1 } } });
    return created;
  });

  // Recommended-for-visit screenings become leads (camp → consultation funnel);
  // link the lead back onto the screening for downstream ROI tracing.
  if (recommendedVisit && phone) {
    const lead = await prisma.lead.create({
      data: { contactName, phone, sourceId: await sourceId("camp"), ownerId: user.id, stage: "interested" },
    });
    await prisma.campPatient.update({ where: { id: cp.id }, data: { leadId: lead.id } });
  }
  await writeAudit({ actorId: user.id, action: "camp.screen", entity: "camp", entityId: campId, after: { contactName, recommendedVisit } });
  revalidatePath(`/camps/${campId}`);
}

// ---------------- Mobile clinics (M8) ----------------

export async function createMobileClinic(fd: FormData): Promise<void> {
  const user = await requireCan("mobile_clinics", "create");
  const routeName = str(fd, "routeName");
  if (!routeName) throw new Error("Route name is required");
  const planRef = str(fd, "planRef");
  await assertPlannedActivity("mobile-clinics", "run_route", planRef);
  const scheduledAt = str(fd, "scheduledAt");
  const created = await prisma.mobileClinic.create({
    data: {
      routeName,
      planRef,
      location: str(fd, "location"),
      branchId: str(fd, "branchId"),
      diseaseId: str(fd, "diseaseId"),
      coordinatorId: user.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      isRecurring: fd.get("isRecurring") === "on",
      expectedPatients: num(fd, "expectedPatients"),
    },
  });
  await writeAudit({ actorId: user.id, action: "mobileclinic.create", entity: "mobile_clinic", entityId: created.id });
  revalidatePath("/mobile-clinics");
  redirect(`/mobile-clinics/${created.id}`);
}

export async function addMobilePatient(clinicId: string, fd: FormData): Promise<void> {
  const user = await requireCan("mobile_clinics", "edit");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  if (!contactName) throw new Error("Patient name is required");
  const riskCategory = (str(fd, "riskCategory") ?? "normal") as ScreeningRisk;
  const referredToBranch = isActionableRisk(riskCategory);
  const screenedById = str(fd, "screenedById") ?? user.id;

  const mp = await prisma.$transaction(async (tx) => {
    const created = await tx.mobileClinicPatient.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { mobileClinicId: clinicId, contactName, phone, age: num(fd, "age"), gender: (str(fd, "gender") as any) ?? null, diseaseId: str(fd, "diseaseId"), complaint: str(fd, "complaint"), riskCategory: riskCategory as any, screenedById, referredToBranch },
    });
    await tx.mobileClinic.update({ where: { id: clinicId }, data: { patientsScreened: { increment: 1 } } });
    return created;
  });

  if (referredToBranch && phone) {
    const lead = await prisma.lead.create({
      data: { contactName, phone, sourceId: await sourceId("mobile_clinic"), ownerId: user.id, stage: "interested" },
    });
    await prisma.mobileClinicPatient.update({ where: { id: mp.id }, data: { leadId: lead.id } });
  }
  await writeAudit({ actorId: user.id, action: "mobileclinic.screen", entity: "mobile_clinic", entityId: clinicId, after: { contactName, referredToBranch } });
  revalidatePath(`/mobile-clinics/${clinicId}`);
}
