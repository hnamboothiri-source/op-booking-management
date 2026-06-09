/**
 * Operator flow map — the ordered Start → … → Result journey for a module.
 * Pure presentational server component: receives already-resolved steps + counts.
 *   - compact: a numbered chip strip for the module dashboard.
 *   - full:    a vertical stepped layout for the Guide page.
 */
import Link from "next/link";
import { NavIcon } from "@/components/shell/NavIcon";
import { LinkButton, Card } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { resolveFilters } from "@/lib/modules/registry";
import type { ResolvedFlowStep } from "@/lib/modules/flow";

export function FlowMap({ steps, variant }: { steps: ResolvedFlowStep[]; variant: "compact" | "full" }) {
  if (steps.length === 0) return null;
  return variant === "compact" ? <CompactStrip steps={steps} /> : <FullGuide steps={steps} />;
}

function CompactStrip({ steps }: { steps: ResolvedFlowStep[] }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-rose-100 dark:border-slate-700">
      <div className="h-1 bg-gradient-to-r from-rose-600 to-gold-500" />
      <div className="flex flex-wrap items-stretch gap-y-2 p-3">
        {steps.map((r, i) => (
          <div key={i} className="flex items-center">
            <Link
              href={r.step.href ?? "#"}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-rose-50 dark:hover:bg-slate-800"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">{i + 1}</span>
              {r.step.icon && <span className="text-rose-500"><NavIcon name={r.step.icon} className="h-4 w-4" /></span>}
              <span className="text-sm font-medium text-slate-700 group-hover:text-rose-700 dark:text-slate-200">{r.step.title}</span>
              {r.count != null && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{r.count}</span>}
            </Link>
            {i < steps.length - 1 && <span className="px-1 text-slate-300" aria-hidden>→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FullGuide({ steps }: { steps: ResolvedFlowStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((r, i) => {
        const first = i === 0;
        const last = i === steps.length - 1;
        return (
          <Card key={i}>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-gold-500 text-sm font-bold text-white">{i + 1}</span>
                {!last && <span className="mt-1 h-full w-px flex-1 bg-rose-100 dark:bg-slate-700" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {r.step.icon && <span className="text-rose-500"><NavIcon name={r.step.icon} className="h-4 w-4" /></span>}
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{r.step.title}</h3>
                  {first && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Start here</span>}
                  {last && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">Result</span>}
                </div>
                {r.step.description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{r.step.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {r.kpi && r.count != null && (
                    <div className="w-40">
                      <DrillStat label={r.kpi.label} value={r.count} entity={r.kpi.entity} filters={resolveFilters(r.kpi.filters)} />
                    </div>
                  )}
                  {r.step.href && <LinkButton href={r.step.href} tone={r.kpi ? "ghost" : "primary"}>{r.step.actionLabel ?? "Open →"}</LinkButton>}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
