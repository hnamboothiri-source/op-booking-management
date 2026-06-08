import { branchScopeWhere, type DrillEntity, type DrillFilters, type RoleName } from "@prm/core";
import { DRILL } from "./registry";

/**
 * Count the records behind a drill entity + filters, reusing the drill
 * registry's buildWhere + preview (whose `total` is a real prisma count). Used
 * by the module dashboards + home master grid so KPI numbers need no bespoke
 * queries. Branch scoping is applied for branch-scoped entities.
 */
export async function drillCount(
  entity: DrillEntity,
  filters: DrillFilters,
  role: RoleName,
  branchId: string | null,
): Promise<number> {
  const def = DRILL[entity];
  const scope = def.branchScoped ? branchScopeWhere(role, branchId) : {};
  const where = { ...scope, ...def.buildWhere(filters) };
  const { total } = await def.preview(where, 0);
  return total;
}
