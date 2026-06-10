"use server";

import { revalidatePath } from "next/cache";
import { rupeesToPaise, type MasterPlanActivity } from "@prm/core";
import { prisma } from "../db";
import { requireCan, requireUser } from "../session";
import { writeAudit } from "../audit";
import { getModuleBySlug } from "../modules/registry";
import { canEditMasterPlan } from "./actions";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

/** Create/update a catalogue activity (the Activity Create Master). Admin-only. */
export async function saveActivityMaster(fd: FormData): Promise<void> {
  const user = await requireCan("masters", "edit");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) throw new Error("Activity name is required");
  const moduleSlug = str(fd, "moduleSlug");
  if (!moduleSlug || !getModuleBySlug(moduleSlug)) throw new Error("A valid module is required");
  const data = {
    name,
    moduleSlug,
    expectedValue: rupeesToPaise(str(fd, "expectedValue")),
    expectedCost: rupeesToPaise(str(fd, "expectedCost")),
    description: str(fd, "description"),
    active: fd.get("active") != null,
  };
  const clash = await prisma.activityMaster.findFirst({ where: { name } });
  if (clash && clash.id !== id) throw new Error(`"${name}" already exists in the catalogue`);
  const saved = id
    ? await prisma.activityMaster.update({ where: { id }, data })
    : await prisma.activityMaster.create({ data: { ...data, active: true } });
  await writeAudit({ actorId: user.id, action: "activitymaster.save", entity: "activity_master", entityId: saved.id, after: data });
  revalidatePath("/master-plan/activities");
  revalidatePath("/master-plan");
}

async function masterPlanGuard(masterPlanId: string) {
  const user = await requireUser();
  const plan = await prisma.masterPlan.findUnique({ where: { id: masterPlanId } });
  if (!plan) throw new Error("Master plan not found");
  if (!(await canEditMasterPlan(user, plan.companyId ?? null))) throw new Error("You may not edit this master plan");
  const activities: MasterPlanActivity[] = Array.isArray(plan.activities) ? [...(plan.activities as unknown as MasterPlanActivity[])] : [];
  return { user, plan, activities };
}

async function writeActivities(masterPlanId: string, activities: MasterPlanActivity[], actorId: string, action: string): Promise<void> {
  await prisma.masterPlan.update({ where: { id: masterPlanId }, data: { activities: activities as never } });
  await writeAudit({ actorId, action, entity: "master_plan", entityId: masterPlanId, after: { activities: activities.length } });
  revalidatePath("/master-plan");
  revalidatePath("/master-plan/variance");
}

/** Add a vision activity: pick from the catalogue, set the count; value/cost = per-unit × count (overridable). */
export async function addMasterActivity(masterPlanId: string, fd: FormData): Promise<void> {
  const { user, activities } = await masterPlanGuard(masterPlanId);
  const activityMasterId = str(fd, "activityMasterId");
  const catalogue = activityMasterId ? await prisma.activityMaster.findUnique({ where: { id: activityMasterId } }) : null;
  if (!catalogue) throw new Error("Pick an activity from the catalogue");
  const count = Math.max(1, parseInt(str(fd, "count") ?? "1", 10) || 1);
  const valueOverride = rupeesToPaise(str(fd, "expectedValue"));
  const costOverride = rupeesToPaise(str(fd, "expectedCost"));
  const quarterRaw = str(fd, "quarter");
  const nextN = activities.reduce((m, a) => Math.max(m, parseInt(a.id.split("-").pop() ?? "0", 10) || 0), 0) + 1;
  activities.push({
    id: `mp-act-${nextN}`,
    activityMasterId: catalogue.id,
    moduleSlug: catalogue.moduleSlug,
    name: catalogue.name,
    count,
    expectedValue: valueOverride > 0 ? valueOverride : catalogue.expectedValue * count,
    expectedCost: costOverride > 0 ? costOverride : catalogue.expectedCost * count,
    quarter: quarterRaw && ["Q1", "Q2", "Q3", "Q4"].includes(quarterRaw) ? (quarterRaw as MasterPlanActivity["quarter"]) : null,
  });
  await writeActivities(masterPlanId, activities, user.id, "masterplan.activity.add");
}

/** Update one vision activity row (count / value / cost / quarter). */
export async function updateMasterActivity(masterPlanId: string, rowId: string, fd: FormData): Promise<void> {
  const { user, activities } = await masterPlanGuard(masterPlanId);
  const i = activities.findIndex((a) => a.id === rowId);
  if (i < 0) throw new Error("Activity row not found");
  const a = activities[i];
  const count = Math.max(1, parseInt(str(fd, "count") ?? String(a.count), 10) || a.count);
  const quarterRaw = str(fd, "quarter");
  activities[i] = {
    ...a,
    count,
    expectedValue: rupeesToPaise(str(fd, "expectedValue")) || a.expectedValue,
    expectedCost: rupeesToPaise(str(fd, "expectedCost")) || a.expectedCost,
    quarter: quarterRaw && ["Q1", "Q2", "Q3", "Q4"].includes(quarterRaw) ? (quarterRaw as MasterPlanActivity["quarter"]) : null,
  };
  await writeActivities(masterPlanId, activities, user.id, "masterplan.activity.update");
}

export async function removeMasterActivity(masterPlanId: string, rowId: string): Promise<void> {
  const { user, activities } = await masterPlanGuard(masterPlanId);
  await writeActivities(masterPlanId, activities.filter((a) => a.id !== rowId), user.id, "masterplan.activity.remove");
}
