import type { ActivityLine } from "@prm/core";
import { prisma } from "../db";

/** The module's active plan (most recent), or null. */
export async function activePlan(slug: string) {
  return prisma.modulePlan.findFirst({ where: { moduleSlug: slug, status: "active" }, orderBy: { createdAt: "desc" } });
}

export interface ApprovedRef { ref: string; label: string }

/** Approved activities of a type in the module's active plan (for form selects). */
export async function approvedActivities(slug: string, typeKey: string): Promise<ApprovedRef[]> {
  const plan = await activePlan(slug);
  if (!plan) return [];
  const acts = (plan.activities as unknown as ActivityLine[]) ?? [];
  return acts
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.typeKey === typeKey && a.approval?.status === "approved")
    .map(({ a, i }) => ({ ref: `${plan.id}:${i}`, label: a.title }));
}

/**
 * The approval gate: a module's discretionary create requires an APPROVED plan
 * activity of `typeKey` in its active plan. `planRef` ("<planId>:<index>") pins a
 * specific one. `system:true` bypasses (auto/internal/clinical call-sites).
 * Throws a user-facing error otherwise.
 */
export async function assertPlannedActivity(
  slug: string,
  typeKey: string,
  planRef?: string | null,
  opts?: { system?: boolean },
): Promise<void> {
  if (opts?.system) return;
  const plan = await activePlan(slug);
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
