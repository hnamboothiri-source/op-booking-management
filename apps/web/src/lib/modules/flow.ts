/**
 * Resolve a module's flow steps into render-ready data: live counts (via the
 * referenced KPI) + RBAC visibility (via the target link's resource) + phase
 * grouping with plan-readiness gating. Server-only (imports drillCount + the
 * planning gate). Kept out of the registry to avoid a client/server tangle.
 */
import { flowPhaseBlocked, type FlowPhase, type RoleName } from "@prm/core";
import { drillCount } from "@/lib/drill/count";
import { effectiveCan, type Principal } from "@/lib/modules/access";
import { resolveFilters, flowStepKpi, gatedActivityKey, type ModuleDef, type ModuleKpi, type FlowStep } from "@/lib/modules/registry";
import { activePlan, approvedActivities } from "@/lib/planning/gate";

export interface ResolvedFlowStep {
  step: FlowStep;
  kpi?: ModuleKpi;
  count?: number;
  phase?: FlowPhase;
  blocked?: boolean;
}

/** Whether the module requires an approved plan, whether one is in place, and the approved labels. */
export interface FlowReadiness {
  required: boolean;
  ready: boolean;
  approvedLabels: string[];
}

export interface ResolvedFlow {
  steps: ResolvedFlowStep[];
  readiness: FlowReadiness;
}

type FlowUser = Principal & { role: RoleName; branchId: string | null };

/** Does the module have an active plan with an approved gating activity? */
export async function flowPlanReadiness(slug: string): Promise<FlowReadiness> {
  const key = gatedActivityKey(slug);
  if (!key) return { required: false, ready: true, approvedLabels: [] };
  const plan = await activePlan(slug).catch(() => null);
  if (!plan) return { required: true, ready: false, approvedLabels: [] };
  const approved = await approvedActivities(slug, key).catch(() => []);
  return { required: true, ready: approved.length > 0, approvedLabels: approved.map((a) => a.label) };
}

/**
 * Resolve each step's live count, gate by the target link's resource, and tag
 * phase + blocked (implementation steps blocked until an approved plan exists).
 * Steps the user cannot reach are dropped. Counts are batched in one Promise.all.
 */
export async function resolveFlow(def: ModuleDef, steps: FlowStep[], user: FlowUser): Promise<ResolvedFlow> {
  const phased = steps.some((s) => s.phase);
  const readiness = phased ? await flowPlanReadiness(def.slug) : { required: false, ready: true, approvedLabels: [] };

  const resolved = await Promise.all(
    steps.map(async (step) => {
      const kpi = flowStepKpi(def, step);
      const count = kpi ? await drillCount(kpi.entity, resolveFilters(kpi.filters), user.role, user.branchId) : undefined;
      const link = def.links.find((l) => l.href === step.href);
      const visible = !link || effectiveCan(user, link.resource, link.action ?? "view");
      const blocked = flowPhaseBlocked(step.phase, readiness.required, readiness.ready);
      return { resolved: { step, kpi, count, phase: step.phase, blocked } as ResolvedFlowStep, visible };
    }),
  );
  return { steps: resolved.filter((r) => r.visible).map((r) => r.resolved), readiness };
}
