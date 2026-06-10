/**
 * Module allotment per centre. A centre's `Branch.enabledModules` lists the
 * modules it runs (empty = all). This resolver turns the current user's
 * effective centre into the allowed-slug list that `accessibleModules` and the
 * module page guards consume. Pure logic lives in @prm/core
 * (`branchModuleEnabled`); this file owns the DB lookups.
 */
import { redirect } from "next/navigation";
import { branchModuleEnabled, isBranchScoped } from "@prm/core";
import { prisma } from "../db";
import type { CurrentUser } from "../session";

/** The centre whose allotment applies: pinned staff use their own centre; company/group users use the switcher selection. */
export function effectiveBranchId(user: CurrentUser): string | null {
  return isBranchScoped(user.role) ? user.branchId : user.activeBranchId;
}

/**
 * Module slugs the user may see: the intersection of the effective centre's
 * allotment and the user's designation module list. Null = no filter
 * (administrators are always unfiltered; either list being absent defers to
 * the other). An empty intersection is a visible misconfiguration on purpose.
 */
export async function allowedModuleSlugsFor(user: CurrentUser): Promise<string[] | null> {
  if (user.role === "administrator") return null;
  const branchId = effectiveBranchId(user);
  let centreList: string[] | null = null;
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const list = (branch?.enabledModules as string[] | undefined) ?? [];
    centreList = list.length ? list : null;
  }
  if (!centreList) return user.designationModules;
  if (!user.designationModules) return centreList;
  return centreList.filter((s) => user.designationModules!.includes(s));
}

/** Page guard: bounce home when the module isn't allotted at the user's centre (navigational, not a permission breach). */
export async function assertModuleAllotted(user: CurrentUser, slug: string): Promise<void> {
  const allowed = await allowedModuleSlugsFor(user);
  if (allowed && !branchModuleEnabled(allowed, slug)) redirect("/");
}
