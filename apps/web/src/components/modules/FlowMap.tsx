/**
 * Operator flow map — the ordered Start → … → Result journey for a module.
 * Pure presentational server component: receives already-resolved steps + counts.
 *   - compact: a numbered chip strip for the module dashboard.
 *   - full:    a vertical stepped layout for the Guide page.
 * When steps carry a `phase`, they render grouped Planning → Implementation →
 * Result, with a plan-readiness badge and locked implementation steps. When no
 * step has a phase, rendering is identical to before (flat journey).
 */
import Link from "next/link";
import { FLOW_PHASES, FLOW_PHASE_LABELS, FLOW_PHASE_TONE, type FlowPhase } from "@prm/core";
import { NavIcon } from "@/components/shell/NavIcon";
import { LinkButton, Card, Badge } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { resolveFilters } from "@/lib/modules/registry";
import type { ResolvedFlowStep, FlowReadiness } from "@/lib/modules/flow";

type Props = { steps: ResolvedFlowStep[]; variant: "compact" | "full"; readiness?: FlowReadiness };

interface PhaseGroup { phase: FlowPhase; rows: { r: ResolvedFlowStep; n: number }[] }

/** Group steps by phase in canonical order, keeping a global 1-based step number. */
function groupByPhase(steps: ResolvedFlowStep[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  steps.forEach((r, i) => {
    const phase = (r.phase ?? "implementation") as FlowPhase;
    let g = groups.find((x) => x.phase === phase);
    if (!g) { g = { phase, rows: [] }; groups.push(g); }
    g.rows.push({ r, n: i + 1 });
  });
  return groups.sort((a, b) => FLOW_PHASES.indexOf(a.phase) - FLOW_PHASES.indexOf(b.phase));
}

export function FlowMap({ steps, variant, readiness }: Props) {
  if (steps.length === 0) return null;
  const phased = steps.some((s) => s.phase);
  if (!phased) return variant === "compact" ? <CompactStrip steps={steps} /> : <FullGuide steps={steps} />;
  return variant === "compact"
    ? <CompactPhased groups={groupByPhase(steps)} readiness={readiness} />
    : <FullPhased groups={groupByPhase(steps)} readiness={readiness} />;
}

// ── Readiness pill (shown on the planning group) ─────────────────────────────
function ReadinessBadge({ readiness }: { readiness?: FlowReadiness }) {
  if (!readiness?.required) return null;
  return readiness.ready
    ? <Badge tone="green">Plan approved ✓</Badge>
    : <Badge tone="amber">No approved plan</Badge>;
}

// ── Phased: compact dashboard strip ──────────────────────────────────────────
function CompactPhased({ groups, readiness }: { groups: PhaseGroup[]; readiness?: FlowReadiness }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-rose-100 dark:border-slate-700">
      <div className="h-1 bg-gradient-to-r from-rose-600 to-gold-500" />
      <div className="space-y-2 p-3">
        {groups.map((g) => (
          <div key={g.phase} className="flex flex-wrap items-center gap-y-2">
            <span className="mr-2 flex items-center gap-1.5">
              <Badge tone={FLOW_PHASE_TONE[g.phase]}>{FLOW_PHASE_LABELS[g.phase]}</Badge>
              {g.phase === "planning" && <ReadinessBadge readiness={readiness} />}
            </span>
            {g.rows.map(({ r, n }, j) => (
              <div key={n} className="flex items-center">
                <Link
                  href={r.blocked ? "#" : r.step.href ?? "#"}
                  aria-disabled={r.blocked}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${r.blocked ? "opacity-50" : "hover:bg-rose-50 dark:hover:bg-slate-800"}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">{n}</span>
                  {r.step.icon && <span className="text-rose-500"><NavIcon name={r.step.icon} className="h-4 w-4" /></span>}
                  <span className="text-sm font-medium text-slate-700 group-hover:text-rose-700 dark:text-slate-200">{r.step.title}</span>
                  {r.blocked && <span title="Locked until the plan is approved" className="text-amber-500">🔒</span>}
                  {r.count != null && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{r.count}</span>}
                </Link>
                {j < g.rows.length - 1 && <span className="px-1 text-slate-300" aria-hidden>→</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Phased: full guide ───────────────────────────────────────────────────────
function FullPhased({ groups, readiness }: { groups: PhaseGroup[]; readiness?: FlowReadiness }) {
  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const blockedHere = g.phase === "implementation" && readiness?.required && !readiness.ready;
        return (
          <div key={g.phase}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={FLOW_PHASE_TONE[g.phase]}>{FLOW_PHASE_LABELS[g.phase]}</Badge>
              {g.phase === "planning" && <ReadinessBadge readiness={readiness} />}
              {blockedHere && <span className="text-xs text-amber-700 dark:text-amber-300">🔒 Locked until an approved plan exists — complete the Planning steps first.</span>}
              {g.phase === "planning" && readiness?.ready && readiness.approvedLabels.length > 0 && (
                <span className="text-xs text-slate-500">Approved: {readiness.approvedLabels.join(", ")}</span>
              )}
            </div>
            <div className="space-y-3">
              {g.rows.map(({ r, n }) => (
                <Card key={n}>
                  <div className={`flex items-start gap-4 ${r.blocked ? "opacity-60" : ""}`}>
                    <div className="flex flex-col items-center">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-gold-500 text-sm font-bold text-white">{n}</span>
                      {n < total && <span className="mt-1 h-full w-px flex-1 bg-rose-100 dark:bg-slate-700" aria-hidden />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.step.icon && <span className="text-rose-500"><NavIcon name={r.step.icon} className="h-4 w-4" /></span>}
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{r.step.title}</h3>
                        {n === 1 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Start here</span>}
                        {n === total && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">Result</span>}
                        {r.blocked && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Needs approved plan</span>}
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
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Unphased (legacy) — unchanged rendering ──────────────────────────────────
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
