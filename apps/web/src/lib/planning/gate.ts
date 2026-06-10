import type { ActivityLine, PlanScope } from "@prm/core";
import { prisma } from "../db";

/**
 * The module's active plan for a scope, falling back centre → company → group.
 * A centre with its own plan is governed by it; otherwise the company plan
 * applies; otherwise the legacy group-wide plan. No scope = group behaviour.
 */
export async function activePlan(slug: string, scope?: PlanScope) {
  if (scope?.branchId) {
    const centre = await prisma.modulePlan.findFirst({
      where: { moduleSlug: slug, status: "active", branchId: scope.branchId },
      orderBy: { createdAt: "desc" },
    });
    if (centre) return centre;
  }
  if (scope?.companyId) {
    const company = await prisma.modulePlan.findFirst({
      where: { moduleSlug: slug, status: "active", branchId: null, companyId: scope.companyId },
      orderBy: { createdAt: "desc" },
    });
    if (company) return company;
  }
  return prisma.modulePlan.findFirst({
    where: { moduleSlug: slug, status: "active", branchId: null, companyId: null },
    orderBy: { createdAt: "desc" },
  });
}

export interface ApprovedRef { ref: string; label: string }

/** Approved activities of a type in the scope's active plan (for form selects). */
export async function approvedActivities(slug: string, typeKey: string, scope?: PlanScope): Promise<ApprovedRef[]> {
  const plan = await activePlan(slug, scope);
  if (!plan) return [];
  const acts = (plan.activities as unknown as ActivityLine[]) ?? [];
  return acts
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.typeKey === typeKey && a.approval?.status === "approved")
    .map(({ a, i }) => ({ ref: `${plan.id}:${i}`, label: a.title }));
}

/**
 * The approval gate: a module's discretionary create requires an APPROVED plan
 * activity of `typeKey` in its active plan (resolved for the actor's scope —
 * centre plan first, then company, then group). `planRef` ("<planId>:<index>")
 * pins a specific one. `system:true` bypasses (auto/internal/clinical call-sites).
 * Throws a user-facing error otherwise.
 */
export async function assertPlannedActivity(
  slug: string,
  typeKey: string,
  planRef?: string | null,
  opts?: { system?: boolean; scope?: PlanScope },
): Promise<void> {
  if (opts?.system) return;
  const plan = await activePlan(slug, opts?.scope);
  if (!plan) throw new Error(`Plan required: ${slug} has no active plan. Create and approve a "${typeKey}" activity on the module's Plan page first.`);
  const acts = (plan.activities as unknown as ActivityLine[]) ?? [];
  if (planRef) {
    const [pid, idxStr] = planRef.split(":");
    const a = pid === plan.id ? acts[Number(idxStr)] : undefined;
    if (a && a.typeKey === typeKey && a.approval?.status === "approved") return;
    throw new Error("The selected plan activity is not approved.");
  }
  if (acts.some((a) => a.typeKey === typeKey && a.approval?.status === "approved")) return;
  throw new Error(`No approved "${typeKey}" activity in the active plan — get it verified & approved first.`);
}
