"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireUser, type CurrentUser } from "../session";
import { canConfigureModule } from "../modules/access";
import { writeAudit } from "../audit";
import type { FieldDef, FieldType } from "../masters/registry";
import { MODULE_FLOWS, getModuleBySlug, moduleFlowHrefs, FLOW_ICONS, type FlowStep } from "../modules/registry";
import type { IconName } from "@/components/shell/NavIcon";
import type { Cadence } from "@prm/core";

export interface PlanConfigShape {
  moduleSlug: string;
  cadence: Cadence;
  monthlyBudget: boolean;
  entryFields: FieldDef[];
  reportColumns: FieldDef[];
  flowSteps: FlowStep[];
}

export type FieldTarget = "entryFields" | "reportColumns";
const FIELD_TYPES: FieldType[] = ["text", "number", "money", "boolean", "select", "textarea", "ref", "date"];

const DEFAULT_CONFIG = (slug: string): PlanConfigShape => ({
  moduleSlug: slug, cadence: "quarterly", monthlyBudget: false, entryFields: [], reportColumns: [], flowSteps: [],
});

/** Require configure rights (administrator or module owner) or redirect. */
async function requireConfigure(slug: string): Promise<CurrentUser> {
  const u = await requireUser();
  if (!canConfigureModule(u, slug)) redirect("/forbidden");
  return u;
}

const asFields = (v: unknown): FieldDef[] => (Array.isArray(v) ? (v as FieldDef[]) : []);
const asFlow = (v: unknown): FlowStep[] => (Array.isArray(v) ? (v as FlowStep[]) : []);

/** Read a module's plan config (row, or a coded default so nothing is ever blocked). */
export async function getPlanConfig(slug: string): Promise<PlanConfigShape> {
  const row = await prisma.planConfig.findUnique({ where: { moduleSlug: slug } });
  if (!row) return DEFAULT_CONFIG(slug);
  const cadence = (["yearly", "quarterly", "monthly", "half_yearly", "custom"].includes(row.cadence) ? row.cadence : "quarterly") as Cadence;
  return {
    moduleSlug: slug,
    cadence,
    monthlyBudget: Boolean(row.monthlyBudget),
    entryFields: asFields(row.entryFields),
    reportColumns: asFields(row.reportColumns),
    flowSteps: asFlow(row.flowSteps),
  };
}

/** A module's resolved operator flow: admin override if any, else the built-in default. */
export async function getModuleFlow(slug: string): Promise<FlowStep[]> {
  const cfg = await getPlanConfig(slug);
  return cfg.flowSteps.length > 0 ? cfg.flowSteps : (MODULE_FLOWS[slug] ?? []);
}

/** Find-or-create the config row, returning its id. */
async function ensureConfigRow(slug: string): Promise<string> {
  const existing = await prisma.planConfig.findUnique({ where: { moduleSlug: slug } });
  if (existing) return existing.id;
  const created = await prisma.planConfig.create({
    data: { moduleSlug: slug, cadence: "quarterly", monthlyBudget: false, entryFields: [], reportColumns: [] },
  });
  return created.id;
}

/** Save cadence + monthly-budget toggle. */
export async function savePlanConfig(slug: string, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const cadence = (fd.get("cadence")?.toString() ?? "quarterly") as Cadence;
  const monthlyBudget = fd.get("monthlyBudget") === "on";
  const id = await ensureConfigRow(slug);
  await prisma.planConfig.update({ where: { id }, data: { cadence, monthlyBudget } });
  await writeAudit({ actorId: user.id, action: "config.cadence", entity: "plan_config", entityId: id, after: { slug, cadence, monthlyBudget } });
  revalidatePath(`/modules/${slug}/configure`);
}

/** Build a FieldDef from the add-field form (shared by config + master builders). */
export async function buildFieldDef(fd: FormData): Promise<FieldDef | null> {
  const name = fd.get("name")?.toString().trim();
  const label = fd.get("label")?.toString().trim();
  const typeRaw = fd.get("type")?.toString().trim() as FieldType;
  if (!name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) return null; // safe identifier only
  const type = FIELD_TYPES.includes(typeRaw) ? typeRaw : "text";
  const field: FieldDef = { name, label: label || name, type, required: fd.get("required") === "on" };
  if (type === "select") {
    const raw = fd.get("options")?.toString() ?? "";
    const options = raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).map((line) => {
      const [value, lbl] = line.split("=").map((x) => x.trim());
      return { value, label: lbl || value };
    });
    if (options.length) field.options = options;
  }
  return field;
}

/** Add a custom field to entryFields or reportColumns. */
export async function addConfigField(slug: string, target: FieldTarget, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const field = await buildFieldDef(fd);
  if (!field) return;
  const cfg = await getPlanConfig(slug);
  const list = [...cfg[target]];
  if (list.some((f) => f.name === field.name)) return; // unique within the list
  list.push(field);
  const id = await ensureConfigRow(slug);
  await prisma.planConfig.update({ where: { id }, data: { [target]: list } });
  await writeAudit({ actorId: user.id, action: "config.field.add", entity: "plan_config", entityId: id, after: { slug, target, field: field.name } });
  revalidatePath(`/modules/${slug}/configure`);
}

/** Remove a custom field from entryFields or reportColumns. */
export async function removeConfigField(slug: string, target: FieldTarget, index: number): Promise<void> {
  const user = await requireConfigure(slug);
  const cfg = await getPlanConfig(slug);
  const list = [...cfg[target]];
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  const id = await ensureConfigRow(slug);
  await prisma.planConfig.update({ where: { id }, data: { [target]: list } });
  await writeAudit({ actorId: user.id, action: "config.field.remove", entity: "plan_config", entityId: id, after: { slug, target, index } });
  revalidatePath(`/modules/${slug}/configure`);
}

// -------------------------------------------------------------- Flow map (operator journey)

const revalidateFlow = (slug: string) => {
  revalidatePath(`/modules/${slug}/configure`);
  revalidatePath(`/modules/${slug}`);
  revalidatePath(`/modules/${slug}/guide`);
};

/** Build a FlowStep from the builder form, validating references against this module. */
function buildFlowStep(slug: string, fd: FormData): FlowStep | null {
  const title = fd.get("title")?.toString().trim();
  if (!title) return null;
  const def = getModuleBySlug(slug);
  const kpiRaw = fd.get("kpiLabel")?.toString().trim();
  const hrefRaw = fd.get("href")?.toString().trim();
  const iconRaw = fd.get("icon")?.toString().trim() as IconName;
  const step: FlowStep = { title };
  const desc = fd.get("description")?.toString().trim();
  if (desc) step.description = desc;
  const actionLabel = fd.get("actionLabel")?.toString().trim();
  if (actionLabel) step.actionLabel = actionLabel;
  if (kpiRaw && def?.kpis.some((k) => k.label === kpiRaw)) step.kpiLabel = kpiRaw;     // must be a real KPI
  if (hrefRaw && moduleFlowHrefs(slug).some((h) => h.href === hrefRaw)) step.href = hrefRaw; // must be an allowed href
  if (iconRaw && FLOW_ICONS.includes(iconRaw)) step.icon = iconRaw;
  return step;
}

/** Current override, or a COPY of the built-in default (so first edit seeds from default). */
function flowBaseline(slug: string, cfg: PlanConfigShape): FlowStep[] {
  return cfg.flowSteps.length > 0 ? [...cfg.flowSteps] : [...(MODULE_FLOWS[slug] ?? [])];
}

export async function addFlowStep(slug: string, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const step = buildFlowStep(slug, fd);
  if (!step) return;
  const cfg = await getPlanConfig(slug);
  const list = flowBaseline(slug, cfg);
  list.push(step);
  const id = await ensureConfigRow(slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.planConfig.update({ where: { id }, data: { flowSteps: list } as any });
  await writeAudit({ actorId: user.id, action: "config.flow.add", entity: "plan_config", entityId: id, after: { slug, title: step.title } });
  revalidateFlow(slug);
}

export async function updateFlowStep(slug: string, index: number, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const step = buildFlowStep(slug, fd);
  if (!step) return;
  const cfg = await getPlanConfig(slug);
  const list = flowBaseline(slug, cfg);
  if (index < 0 || index >= list.length) return;
  list[index] = step;
  const id = await ensureConfigRow(slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.planConfig.update({ where: { id }, data: { flowSteps: list } as any });
  await writeAudit({ actorId: user.id, action: "config.flow.update", entity: "plan_config", entityId: id, after: { slug, index } });
  revalidateFlow(slug);
}

export async function removeFlowStep(slug: string, index: number): Promise<void> {
  const user = await requireConfigure(slug);
  const cfg = await getPlanConfig(slug);
  const list = flowBaseline(slug, cfg);
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  const id = await ensureConfigRow(slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.planConfig.update({ where: { id }, data: { flowSteps: list } as any });
  await writeAudit({ actorId: user.id, action: "config.flow.remove", entity: "plan_config", entityId: id, after: { slug, index } });
  revalidateFlow(slug);
}

export async function moveFlowStep(slug: string, index: number, dir: "up" | "down"): Promise<void> {
  const user = await requireConfigure(slug);
  const cfg = await getPlanConfig(slug);
  const list = flowBaseline(slug, cfg);
  const j = dir === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
  const id = await ensureConfigRow(slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.planConfig.update({ where: { id }, data: { flowSteps: list } as any });
  await writeAudit({ actorId: user.id, action: "config.flow.move", entity: "plan_config", entityId: id, after: { slug, index, dir } });
  revalidateFlow(slug);
}

/** Clear the override so the module re-inherits the built-in default flow. */
export async function resetFlow(slug: string): Promise<void> {
  const user = await requireConfigure(slug);
  const id = await ensureConfigRow(slug);
  await prisma.planConfig.update({ where: { id }, data: { flowSteps: [] } });
  await writeAudit({ actorId: user.id, action: "config.flow.reset", entity: "plan_config", entityId: id, after: { slug } });
  revalidateFlow(slug);
}
