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
 * Module slugs the user's effective centre runs, or null when no filter
 * applies: administrators (never self-locked out of admin UIs), users with no
 * effective centre ("All centres"), or a centre with an empty list (= all).
 */
export async function allowedModuleSlugsFor(user: CurrentUser): Promise<string[] | null> {
  if (user.role === "administrator") return null;
  const branchId = effectiveBranchId(user);
  if (!branchId) return null;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  const list = (branch?.enabledModules as string[] | undefined) ?? [];
  return list.length ? list : null;
}

/** Page guard: bounce home when the module isn't allotted at the user's centre (navigational, not a permission breach). */
export async function assertModuleAllotted(user: CurrentUser, slug: string): Promise<void> {
  const allowed = await allowedModuleSlugsFor(user);
  if (allowed && !branchModuleEnabled(allowed, slug)) redirect("/");
}
