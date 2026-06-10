/**
 * Company / group consolidation rollups. One shared implementation so the
 * group dashboard, the company pages and any report agree on the arithmetic:
 * group totals = Σ company totals = Σ centre totals.
 *
 * Server-only: imports prisma + the drill registry.
 */
import { conversionRate, type ActivityLine, type DrillEntity, type DrillFilters, type TargetLine } from "@prm/core";
import { prisma } from "../db";
import { DRILL } from "../drill/registry";
import { getModuleBySlug, resolveFilters } from "../modules/registry";

export interface CompanyWithCentres {
  id: string;
  name: string;
  shortName: string | null;
  code: string | null;
  centres: { id: string; name: string; type: string; location: string | null }[];
}

/** Active companies with their active centres. */
export async function companiesWithCentres(): Promise<CompanyWithCentres[]> {
  const [companies, branches] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName ?? null,
    code: c.code ?? null,
    centres: branches
      .filter((b) => b.companyId === c.id)
      .map((b) => ({ id: b.id, name: b.name, type: String(b.type ?? "hospital"), location: b.location ?? null })),
  }));
}

/** Count records behind a drill entity for a set of centres (no role scoping — callers gate by RBAC). */
export async function centreSetCount(entity: DrillEntity, filters: DrillFilters, branchIds: string[]): Promise<number> {
  const def = DRILL[entity];
  const scope = def.branchScoped && branchIds.length ? { branchId: { in: branchIds } } : {};
  const where = { ...scope, ...def.buildWhere(filters) };
  const { total } = await def.preview(where, 0);
  return total;
}

export interface CentrePerf {
  id: string;
  name: string;
  type: string;
  leads: number;
  appointments: number;
  consultations: number;
  conv: number;
}

/** Per-centre performance rows (same arithmetic as the home branch table). */
export async function centrePerformance(centres: { id: string; name: string; type: string }[]): Promise<CentrePerf[]> {
  return Promise.all(centres.map(async (c) => {
    const [leads, appointments, consultations] = await Promise.all([
      prisma.lead.count({ where: { branchId: c.id } }),
      prisma.opBooking.count({ where: { branchId: c.id } }),
      prisma.consultation.count({ where: { branchId: c.id } }),
    ]);
    return { id: c.id, name: c.name, type: c.type, leads, appointments, consultations, conv: conversionRate(consultations, leads) };
  }));
}

export interface ModulePlanRollup {
  moduleSlug: string;
  moduleName: string;
  plans: number;
  plannedBudget: number; // paise, Σ across centre plans
  targets: { label: string; kpiLabel: string | null; target: number; actual: number | null; unit: string | null }[];
  /** Set when the rollup covers a single plan (e.g. one company plan per module). */
  title?: string | null;
  period?: string | null;
  objective?: string | null;
}

/**
 * Roll up the ACTIVE centre plans of a set of centres, per module: summed
 * budgets and targets (grouped by KPI label), with live actuals for targets
 * linked to a module KPI — counted across the same centre set.
 */
export async function planTargetRollup(branchIds: string[]): Promise<ModulePlanRollup[]> {
  if (!branchIds.length) return [];
  const plans = await prisma.modulePlan.findMany({
    where: { status: "active", branchId: { in: branchIds } },
    orderBy: { createdAt: "desc" },
  });
  return rollupPlans(plans, branchIds);
}

/**
 * The company's OWN business plans (companyId set, no centre): targets are
 * company-wide, so actuals are counted across all the company's centres.
 */
export async function companyPlanRollup(companyId: string, branchIds: string[]): Promise<ModulePlanRollup[]> {
  const plans = await prisma.modulePlan.findMany({
    where: { status: "active", branchId: null, companyId },
    orderBy: { createdAt: "desc" },
  });
  return rollupPlans(plans, branchIds);
}

type PlanRow = Awaited<ReturnType<typeof prisma.modulePlan.findMany>>;

async function rollupPlans(plans: PlanRow, branchIds: string[]): Promise<ModulePlanRollup[]> {
  const bySlug = new Map<string, typeof plans>();
  for (const p of plans) {
    const list = bySlug.get(p.moduleSlug) ?? [];
    list.push(p);
    bySlug.set(p.moduleSlug, list);
  }
  const out: ModulePlanRollup[] = [];
  for (const [slug, slugPlans] of bySlug) {
    const def = getModuleBySlug(slug);
    // Sum targets across centres by (kpiLabel ?? label).
    const targetSums = new Map<string, { label: string; kpiLabel: string | null; target: number; unit: string | null }>();
    for (const p of slugPlans) {
      for (const t of ((p.targets as unknown as TargetLine[] | null) ?? [])) {
        const key = t.kpiLabel ?? t.label;
        const cur = targetSums.get(key) ?? { label: t.label, kpiLabel: t.kpiLabel ?? null, target: 0, unit: t.unit ?? null };
        cur.target += t.target;
        targetSums.set(key, cur);
      }
    }
    const targets = await Promise.all([...targetSums.values()].map(async (t) => {
      const kpi = t.kpiLabel ? def?.kpis.find((k) => k.label === t.kpiLabel) : undefined;
      const actual = kpi ? await centreSetCount(kpi.entity, resolveFilters(kpi.filters), branchIds) : null;
      return { ...t, actual };
    }));
    const single = slugPlans.length === 1 ? slugPlans[0] : null;
    out.push({
      moduleSlug: slug,
      moduleName: def?.name ?? slug,
      plans: slugPlans.length,
      plannedBudget: slugPlans.reduce((s, p) => s + (p.plannedBudget ?? 0), 0),
      targets,
      title: single?.title ?? null,
      period: single?.period ?? null,
      objective: single?.objective ?? null,
    });
  }
  return out.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

/** Σ budget of every active plan in scope, including activity-level budgets. */
export function plansBudget(rollups: ModulePlanRollup[]): number {
  return rollups.reduce((s, r) => s + r.plannedBudget, 0);
}

export interface CompanySummary {
  leads: number;
  appointments: number;
  consultations: number;
  conv: number;
}

/** Headline figures for a set of centres (used by both company + group pages). */
export async function centreSetSummary(branchIds: string[]): Promise<CompanySummary> {
  if (!branchIds.length) return { leads: 0, appointments: 0, consultations: 0, conv: 0 };
  const where = { branchId: { in: branchIds } };
  const [leads, appointments, consultations] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.opBooking.count({ where }),
    prisma.consultation.count({ where }),
  ]);
  return { leads, appointments, consultations, conv: conversionRate(consultations, leads) };
}

// Re-exported for pages that need activity rollups later.
export type { ActivityLine };
