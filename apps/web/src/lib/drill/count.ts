import type { DrillEntity, DrillFilters, RoleName } from "@prm/core";
import { DRILL } from "./registry";
import { userScopeWhere } from "@/lib/scope";

/** The slice of the session a query scope needs (kept narrow for tests). */
export interface ScopeUser {
  role: RoleName;
  branchId: string | null;
  companyId?: string | null;
  activeBranchId?: string | null;
}

/**
 * Count the records behind a drill entity + filters, reusing the drill
 * registry's buildWhere + preview (whose `total` is a real prisma count). Used
 * by the module dashboards + home master grid so KPI numbers need no bespoke
 * queries. Org scoping (centre / company / group + centre switcher) is applied
 * for branch-scoped entities.
 */
export async function drillCount(
  entity: DrillEntity,
  filters: DrillFilters,
  user: ScopeUser,
): Promise<number> {
  const def = DRILL[entity];
  const scope = def.branchScoped
    ? await userScopeWhere({ role: user.role, branchId: user.branchId, companyId: user.companyId ?? null, activeBranchId: user.activeBranchId ?? null })
    : {};
  const where = { ...scope, ...def.buildWhere(filters) };
  const { total } = await def.preview(where, 0);
  return total;
}
