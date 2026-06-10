/**
 * Org-aware query scoping. Resolves the centre list a user may see (their own
 * centre, their company's centres, or everything) and builds the Prisma `where`
 * fragment via the pure `orgScopeWhere` from @prm/core.
 */
import { isCompanyScoped, orgScopeWhere, type OrgScopeWhere } from "@prm/core";
import { prisma } from "./db";
import type { CurrentUser } from "./session";

type ScopeUser = Pick<CurrentUser, "role" | "branchId" | "companyId" | "activeBranchId">;

/** Active centre ids of a company (null when no company given). */
export async function companyBranchIds(companyId: string | null): Promise<string[] | null> {
  if (!companyId) return null;
  const rows = await prisma.branch.findMany({ where: { companyId, active: true }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Prisma `where` fragment confining queries to the user's org scope. */
export async function userScopeWhere(user: ScopeUser): Promise<OrgScopeWhere> {
  const ids = isCompanyScoped(user.role) ? await companyBranchIds(user.companyId) : null;
  return orgScopeWhere(user.role, user.branchId, ids, user.activeBranchId);
}
