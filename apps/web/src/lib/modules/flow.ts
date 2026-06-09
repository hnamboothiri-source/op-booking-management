/**
 * Resolve a module's flow steps into render-ready data: live counts (via the
 * referenced KPI) + RBAC visibility (via the target link's resource). Server-only
 * (imports drillCount). Kept out of the registry to avoid a client/server tangle.
 */
import type { RoleName } from "@prm/core";
import { drillCount } from "@/lib/drill/count";
import { effectiveCan, type Principal } from "@/lib/modules/access";
import { resolveFilters, flowStepKpi, type ModuleDef, type ModuleKpi, type FlowStep } from "@/lib/modules/registry";

export interface ResolvedFlowStep {
  step: FlowStep;
  kpi?: ModuleKpi;
  count?: number;
}

type FlowUser = Principal & { role: RoleName; branchId: string | null };

/**
 * Resolve each step's live count and gate by the target link's resource. Steps
 * the user cannot reach are dropped. Counts are batched in one Promise.all.
 */
export async function resolveFlow(def: ModuleDef, steps: FlowStep[], user: FlowUser): Promise<ResolvedFlowStep[]> {
  const resolved = await Promise.all(
    steps.map(async (step) => {
      const kpi = flowStepKpi(def, step);
      const count = kpi ? await drillCount(kpi.entity, resolveFilters(kpi.filters), user.role, user.branchId) : undefined;
      const link = def.links.find((l) => l.href === step.href);
      const visible = !link || effectiveCan(user, link.resource, link.action ?? "view");
      return { resolved: { step, kpi, count } as ResolvedFlowStep, visible };
    }),
  );
  return resolved.filter((r) => r.visible).map((r) => r.resolved);
}
