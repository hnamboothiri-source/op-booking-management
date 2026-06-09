"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rupeesToPaise, canVerify, canApprove, separationOk, cadencePeriods, type Cadence, type TargetLine, type ActivityLine, type Approval, type ChangeEntry, type PlanStatus } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { getModuleBySlug, getPlanActivityType } from "../modules/registry";
import { getPlanConfig } from "../config/actions";
import { buildData } from "../masters/coerce";
import type { CurrentUser } from "../session";

const nowIso = () => new Date().toISOString();
const readActivities = (plan: { activities: unknown } | null): ActivityLine[] =>
  Array.isArray(plan?.activities) ? [...(plan!.activities as unknown as ActivityLine[])] : [];

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Gate by the module's RBAC resource and return the plan + slug. */
async function planGuard(planId: string, action: "view" | "edit"): Promise<{ user: CurrentUser; slug: string }> {
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");
  const def = getModuleBySlug(plan.moduleSlug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await requireCan((def?.resource ?? "dashboards") as any, action);
  return { user, slug: plan.moduleSlug };
}

async function patchPlan(planId: string, action: string, data: Record<string, unknown>): Promise<string> {
  const { user, slug } = await planGuard(planId, "edit");
  await prisma.modulePlan.update({ where: { id: planId }, data });
  await writeAudit({ actorId: user.id, action, entity: "module_plan", entityId: planId });
  revalidatePath(`/modules/${slug}/plan`);
  return slug;
}

export async function createModulePlan(slug: string, fd: FormData): Promise<void> {
  const def = getModuleBySlug(slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await requireCan((def?.resource ?? "dashboards") as any, "edit");
  const title = str(fd, "title") ?? `${def?.name ?? slug} plan`;
  const ps = str(fd, "periodStart");
  const pe = str(fd, "periodEnd");
  const created = await prisma.modulePlan.create({
    data: {
      moduleSlug: slug,
      title,
      period: str(fd, "period"),
      periodStart: ps ? new Date(ps) : null,
      periodEnd: pe ? new Date(pe) : null,
      objective: str(fd, "objective"),
      plannedBudget: rupeesToPaise(str(fd, "plannedBudget")),
      ownerId: user.id,
      status: "draft",
      targets: [],
      activities: [],
    },
  });
  await writeAudit({ actorId: user.id, action: "plan.create", entity: "module_plan", entityId: created.id, after: { slug } });
  revalidatePath(`/modules/${slug}/plan`);
  redirect(`/modules/${slug}/plan`);
}

/**
 * Create a plan for a cadence-driven period. The chosen `periodKey` (e.g.
 * "2026-Q3") is resolved back to its start/end via the module's cadence, so the
 * manager picks from a fixed period set rather than typing free-form dates.
 */
export async function createPlanForPeriod(slug: string, fd: FormData): Promise<void> {
  const def = getModuleBySlug(slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await requireCan((def?.resource ?? "dashboards") as any, "edit");
  const cfg = await getPlanConfig(slug);
  const periodKey = str(fd, "periodKey");
  let period = periodKey;
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (periodKey) {
    const year = parseInt(periodKey.slice(0, 4), 10);
    const match = cadencePeriods(cfg.cadence as Cadence, Number.isFinite(year) ? year : new Date().getFullYear()).find((p) => p.label === periodKey);
    if (match) { period = match.label; periodStart = new Date(match.start); periodEnd = new Date(match.end); }
  }
  const created = await prisma.modulePlan.create({
    data: {
      moduleSlug: slug,
      title: str(fd, "title") ?? `${def?.name ?? slug} — ${period ?? "plan"}`,
      period,
      periodStart,
      periodEnd,
      objective: str(fd, "objective"),
      plannedBudget: rupeesToPaise(str(fd, "plannedBudget")),
      ownerId: user.id,
      status: "draft",
      targets: [],
      activities: [],
    },
  });
  await writeAudit({ actorId: user.id, action: "plan.create", entity: "module_plan", entityId: created.id, after: { slug, period } });
  revalidatePath(`/modules/${slug}/plan`);
  redirect(`/modules/${slug}/plan`);
}

/** Save the month-wise budget breakdown (yearly cadence + monthlyBudget). */
export async function saveBudgetBreakdown(planId: string, fd: FormData): Promise<void> {
  const breakdown: Record<string, number> = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("m_")) continue;
    const paise = rupeesToPaise(v.toString());
    if (paise) breakdown[k.slice(2)] = paise;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await patchPlan(planId, "plan.budget.breakdown", { budgetBreakdown: breakdown as any });
}

export async function updateModulePlan(planId: string, fd: FormData): Promise<void> {
  const ps = str(fd, "periodStart");
  const pe = str(fd, "periodEnd");
  await patchPlan(planId, "plan.update", {
    title: str(fd, "title") ?? "Plan",
    period: str(fd, "period"),
    periodStart: ps ? new Date(ps) : null,
    periodEnd: pe ? new Date(pe) : null,
    objective: str(fd, "objective"),
    plannedBudget: rupeesToPaise(str(fd, "plannedBudget")),
  });
}

export async function setPlanStatus(planId: string, status: PlanStatus): Promise<void> {
  const { slug } = await planGuard(planId, "edit");
  // Only one active plan per module.
  if (status === "active") {
    await prisma.modulePlan.updateMany({ where: { moduleSlug: slug, status: "active" }, data: { status: "closed" } });
  }
  await patchPlan(planId, "plan.status", { status });
}

export async function saveTarget(planId: string, fd: FormData): Promise<void> {
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list: TargetLine[] = Array.isArray(plan?.targets) ? [...(plan!.targets as unknown as TargetLine[])] : [];
  const kpiLabel = str(fd, "kpiLabel");
  const line: TargetLine = {
    kpiLabel,
    label: str(fd, "label") ?? kpiLabel ?? "Target",
    target: Number(str(fd, "target") ?? "0") || 0,
    unit: str(fd, "unit"),
  };
  const idx = num(fd, "index");
  if (idx != null && idx >= 0 && idx < list.length) list[idx] = line;
  else list.push(line);
  await patchPlan(planId, "plan.target", { targets: list });
}

export async function removeTarget(planId: string, index: number): Promise<void> {
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list: TargetLine[] = Array.isArray(plan?.targets) ? [...(plan!.targets as unknown as TargetLine[])] : [];
  if (index >= 0 && index < list.length) list.splice(index, 1);
  await patchPlan(planId, "plan.target.remove", { targets: list });
}

/** Enter a new activity (maker step). Starts in `entered`, awaiting verification. */
export async function saveActivity(planId: string, fd: FormData): Promise<void> {
  const { user, slug } = await planGuard(planId, "edit");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  const typeKey = str(fd, "typeKey");
  const cfg = await getPlanConfig(slug);
  const custom = buildData(cfg.entryFields, fd);
  const approval: Approval = { status: "entered", enteredById: user.id, enteredAt: nowIso() };
  const log: ChangeEntry = { at: nowIso(), byId: user.id, byRank: user.planRank, action: "entered" };
  list.push({
    title: str(fd, "title") ?? getPlanActivityType(slug, typeKey ?? "")?.label ?? "Activity",
    typeKey,
    target: num(fd, "target"),
    ownerId: str(fd, "ownerId"),
    dueDate: str(fd, "dueDate"),
    budget: str(fd, "budget") != null ? rupeesToPaise(str(fd, "budget")) : null,
    status: "planned",
    taskId: null,
    draftEntityId: null,
    approval,
    changeLog: [log],
    custom: Object.keys(custom).length ? custom : undefined,
  });
  await patchPlan(planId, "plan.activity.enter", { activities: list });
}

/** Edit an activity. Records the change and resets approval to `entered`. */
export async function editActivity(planId: string, index: number, fd: FormData): Promise<void> {
  const { user, slug } = await planGuard(planId, "edit");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  const a = list[index];
  if (!a) throw new Error("Activity not found");
  const cfg = await getPlanConfig(slug);
  const custom = buildData(cfg.entryFields, fd);
  const detail = `title:${a.title}→${str(fd, "title") ?? a.title}; target:${a.target ?? ""}→${num(fd, "target") ?? ""}`;
  const log: ChangeEntry = { at: nowIso(), byId: user.id, byRank: user.planRank, action: "edited", detail };
  list[index] = {
    ...a,
    title: str(fd, "title") ?? a.title,
    target: num(fd, "target") ?? a.target,
    ownerId: str(fd, "ownerId") ?? a.ownerId,
    dueDate: str(fd, "dueDate") ?? a.dueDate,
    budget: str(fd, "budget") != null ? rupeesToPaise(str(fd, "budget")) : a.budget,
    custom: Object.keys(custom).length ? { ...(a.custom ?? {}), ...custom } : a.custom,
    approval: { ...(a.approval ?? { status: "entered" }), status: "entered", verifiedById: null, verifiedAt: null, approvedById: null, approvedAt: null },
    changeLog: [...(a.changeLog ?? []), log],
  };
  await patchPlan(planId, "plan.activity.edit", { activities: list });
}

/** Supervisor verifies (checker step). */
export async function verifyActivity(planId: string, index: number): Promise<void> {
  const { user } = await planGuard(planId, "edit");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  const a = list[index];
  if (!a) throw new Error("Activity not found");
  if (!canVerify(user.planRank)) throw new Error("Only a supervisor or manager can verify.");
  if (!separationOk("verify", user.id, a.approval ?? { status: "entered" }, user.role === "administrator")) throw new Error("The person who entered an activity cannot verify it.");
  list[index] = {
    ...a,
    approval: { ...(a.approval ?? { status: "entered" }), status: "verified", verifiedById: user.id, verifiedAt: nowIso() },
    changeLog: [...(a.changeLog ?? []), { at: nowIso(), byId: user.id, byRank: user.planRank, action: "verified" }],
  };
  await patchPlan(planId, "plan.activity.verify", { activities: list });
}

/** Manager approves (approver step) — unlocks execution. */
export async function approveActivity(planId: string, index: number): Promise<void> {
  const { user } = await planGuard(planId, "edit");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  const a = list[index];
  if (!a) throw new Error("Activity not found");
  if (!canApprove(user.planRank)) throw new Error("Only a manager can approve.");
  if (a.approval?.status !== "verified") throw new Error("Activity must be verified before approval.");
  if (!separationOk("approve", user.id, a.approval, user.role === "administrator")) throw new Error("The enterer/verifier cannot approve.");
  list[index] = {
    ...a,
    approval: { ...a.approval, status: "approved", approvedById: user.id, approvedAt: nowIso() },
    changeLog: [...(a.changeLog ?? []), { at: nowIso(), byId: user.id, byRank: user.planRank, action: "approved" }],
  };
  await patchPlan(planId, "plan.activity.approve", { activities: list });
}

/** Send an activity back (rejected → re-entry). */
export async function rejectActivity(planId: string, index: number, fd: FormData): Promise<void> {
  const { user } = await planGuard(planId, "edit");
  if (!canVerify(user.planRank)) throw new Error("Only a supervisor or manager can reject.");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  const a = list[index];
  if (!a) throw new Error("Activity not found");
  const note = str(fd, "note");
  list[index] = {
    ...a,
    approval: { ...(a.approval ?? { status: "entered" }), status: "rejected", note },
    changeLog: [...(a.changeLog ?? []), { at: nowIso(), byId: user.id, byRank: user.planRank, action: "rejected", detail: note }],
  };
  await patchPlan(planId, "plan.activity.reject", { activities: list });
}

export async function setActivityStatus(planId: string, index: number, status: ActivityLine["status"]): Promise<void> {
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  if (list[index]) list[index] = { ...list[index], status };
  await patchPlan(planId, "plan.activity.status", { activities: list });
}

export async function removeActivity(planId: string, index: number): Promise<void> {
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  if (index >= 0 && index < list.length) list.splice(index, 1);
  await patchPlan(planId, "plan.activity.remove", { activities: list });
}

/** Create a draft entity (camp/route/campaign/schedule) from an APPROVED activity. */
export async function createDraftFromActivity(planId: string, index: number): Promise<void> {
  const { user, slug } = await planGuard(planId, "edit");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list = readActivities(plan);
  const a = list[index];
  if (!a) throw new Error("Activity not found");
  if (a.approval?.status !== "approved") throw new Error("Approve the activity before creating its draft.");
  const planRef = `${planId}:${index}`;
  let href = `/modules/${slug}/plan`;
  let draftId: string | null = null;
  if (slug === "camps") {
    const c = await prisma.camp.create({ data: { name: a.title, status: "planned", planRef } });
    draftId = c.id; href = `/camps/${c.id}`;
  } else if (slug === "mobile-clinics") {
    const m = await prisma.mobileClinic.create({ data: { routeName: a.title, status: "planned", planRef } });
    draftId = m.id; href = `/mobile-clinics/${m.id}`;
  } else if (slug === "campaigns") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = await prisma.campaign.create({ data: { name: a.title, type: "facebook_ads" as any, planRef } });
    draftId = c.id; href = `/campaigns/${c.id}`;
  } else {
    throw new Error("This module has no draft entity.");
  }
  list[index] = { ...a, draftEntityId: draftId };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.modulePlan.update({ where: { id: planId }, data: { activities: list as any } });
  await writeAudit({ actorId: user.id, action: "plan.activity.draft", entity: "module_plan", entityId: planId, after: { draftId, slug } });
  revalidatePath(`/modules/${slug}/plan`);
  redirect(href);
}

/** Push a planned activity into the Tasks module (M15) for its owner. */
export async function pushActivityToTask(planId: string, index: number): Promise<void> {
  const { user, slug } = await planGuard(planId, "edit");
  const plan = await prisma.modulePlan.findUnique({ where: { id: planId } });
  const list: ActivityLine[] = Array.isArray(plan?.activities) ? [...(plan!.activities as unknown as ActivityLine[])] : [];
  const a = list[index];
  if (!a) throw new Error("Activity not found");
  const task = await prisma.task.create({
    data: {
      type: "module_activity",
      subject: `${getModuleBySlug(slug)?.name ?? slug}: ${a.title}`,
      assigneeId: a.ownerId ?? user.id,
      dueDate: a.dueDate ? new Date(a.dueDate) : null,
      priority: "medium",
      status: "open",
    },
  });
  list[index] = { ...a, taskId: task.id };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.modulePlan.update({ where: { id: planId }, data: { activities: list as any } });
  await writeAudit({ actorId: user.id, action: "plan.activity.task", entity: "module_plan", entityId: planId, after: { taskId: task.id } });
  revalidatePath(`/modules/${slug}/plan`);
}
