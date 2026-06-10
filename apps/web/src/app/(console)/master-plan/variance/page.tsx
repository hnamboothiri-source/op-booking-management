import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatINR, isBranchScoped, planProgressPct, budgetTotals, allotmentSummary,
  activityTotalsByModule, visionActivityStatus, varianceRow,
  type ActivityLine, type AdoptedTotals, type MasterPlanActivity, type MasterPlanLine,
  type OutreachExpenseLine, type OutreachStaffLine,
} from "@prm/core";
import { requireUser } from "@/lib/session";
import { canUseTool } from "@/lib/tools";
import { prisma } from "@/lib/db";
import { MODULE_DASHBOARDS, resolveFilters } from "@/lib/modules/registry";
import { centreSetCount } from "@/lib/consolidation/rollup";
import { PageHeader, Card, Badge } from "@/components/ui";
import { BarChartCard } from "@/components/charts/BarChartCard";

export const dynamic = "force-dynamic";

const moduleName = (slug: string) => MODULE_DASHBOARDS.find((m) => m.slug === slug)?.name ?? slug;

/**
 * Variance report: the directors' master figures vs the managers' amended plan
 * figures vs actuals (where captured) — plus the activity running/pending chart.
 */
export default async function VariancePage({ searchParams }: { searchParams: Promise<{ scope?: string; year?: string }> }) {
  const user = await requireUser();
  if (!canUseTool(user, "reports", "reports")) redirect("/forbidden");
  if (isBranchScoped(user.role)) redirect("/");
  const sp = await searchParams;
  const year = parseInt(sp.year ?? "", 10) || new Date().getUTCFullYear();
  const scope = sp.scope ?? "group";

  const [companies, masterPlans, modulePlans, camps, mobiles] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.masterPlan.findMany({ where: { year } }),
    prisma.modulePlan.findMany({ where: { status: "active" } }),
    prisma.camp.findMany({}),
    prisma.mobileClinic.findMany({}),
  ]);
  const companyId = scope === "group" ? null : companies.find((c) => c.id === scope)?.id ?? null;
  const masterPlan = masterPlans.find((m) => (m.companyId ?? null) === companyId) ?? null;
  const visionActivities = ((masterPlan?.activities as unknown as MasterPlanActivity[] | null) ?? []);
  const lines = ((masterPlan?.lines as unknown as MasterPlanLine[] | null) ?? []);

  // Match adopted plan activities to vision activities by masterActivityId.
  const adoptedFor = (rowId: string): AdoptedTotals & { actualCost: number | null } => {
    let plans = 0, target = 0, budget = 0, done = 0, actualCost = 0, actualSeen = false;
    for (const p of modulePlans) {
      for (const a of ((p.activities as unknown as ActivityLine[] | null) ?? [])) {
        if (a.masterActivityId !== rowId) continue;
        plans += 1;
        target += a.target ?? 0;
        budget += a.budget ?? 0;
        if (a.status === "done") done += 1;
        // Actual spend where the activity is linked to a completed outreach event.
        if (a.draftEntityId) {
          const ev = camps.find((c) => c.id === a.draftEntityId) ?? mobiles.find((m) => m.id === a.draftEntityId);
          if (ev && ev.status === "completed") {
            actualCost += budgetTotals(
              (ev.expenses as OutreachExpenseLine[] | null) ?? [],
              (ev.staffRoster as OutreachStaffLine[] | null) ?? [],
            ).actualTotal;
            actualSeen = true;
          }
        }
      }
    }
    return { plans, target, budget, done, actualCost: actualSeen ? actualCost : null };
  };
  const adopted = new Map(visionActivities.map((va) => [va.id, adoptedFor(va.id)]));

  // Running/pending chart data (counts of vision activities by status).
  const statusCounts = { pending: 0, running: 0, done: 0 };
  for (const va of visionActivities) statusCounts[visionActivityStatus(adopted.get(va.id))] += 1;

  // Module totals: allocation vs activity expectation vs dept plan budgets vs KPI actual.
  const activityTotals = activityTotalsByModule(visionActivities);
  const moduleRows = await Promise.all(Object.entries(activityTotals).map(async ([slug, t]) => {
    const line = lines.find((l) => l.moduleSlug === slug) ?? null;
    const deptBudget = modulePlans.filter((p) => p.moduleSlug === slug).reduce((s, p) => s + (p.plannedBudget ?? 0), 0);
    const kpi = line?.kpiLabel ? MODULE_DASHBOARDS.find((m) => m.slug === slug)?.kpis.find((k) => k.label === line.kpiLabel) : null;
    const kpiActual = kpi ? await centreSetCount(kpi.entity, resolveFilters(kpi.filters), []) : null;
    return { slug, ...t, allocation: line?.yearlyValue ?? 0, deptBudget, kpiLabel: line?.kpiLabel ?? null, kpiTarget: line?.yearlyTarget ?? null, kpiActual };
  }));

  const fmtVar = (v: number | null, pct: number | null) =>
    v == null ? "—" : `${v > 0 ? "+" : ""}${formatINR(v)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}`;

  return (
    <main>
      <PageHeader title="Variance report — vision vs departments vs actuals" subtitle="Directors' master figures, the managers' amended plan figures, and actual costs where captured" />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/master-plan" className="text-slate-500 hover:underline">← Master plan (vision)</Link>
        <Link href="/master-plan/activities" className="text-rose-700 hover:underline dark:text-rose-300">Activity master →</Link>
        <span className="mx-1 text-slate-300">|</span>
        {[{ id: "group", label: "Group" }, ...companies.map((c) => ({ id: c.id, label: (c.code ?? c.shortName) as string }))].map((s) => (
          <Link key={s.id} href={`/master-plan/variance?scope=${s.id}&year=${year}`} className={`rounded-full px-3 py-1 ${scope === s.id ? "bg-rose-600 font-medium text-white" : "border border-slate-300 text-slate-600 hover:bg-rose-50"}`}>{s.label}</Link>
        ))}
        <Badge tone="slate">{year}</Badge>
        {masterPlan && (() => {
          const s = allotmentSummary((masterPlan.targetValue as number | undefined) ?? 0, lines);
          return s.target > 0 ? <span className="text-xs text-slate-500">Target {formatINR(s.target)} · allotted {s.pct}%</span> : null;
        })()}
      </div>

      {!masterPlan ? (
        <Card><p className="text-sm text-slate-400">No master plan for this scope and year yet — create one on the <Link href="/master-plan" className="text-rose-700 hover:underline">Master plan page</Link>.</p></Card>
      ) : (
        <>
          {/* Activity running & pending chart */}
          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card accent>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Vision activities — running &amp; pending</div>
              <BarChartCard data={[
                { label: "Pending (not adopted)", value: statusCounts.pending },
                { label: "Running (adopted)", value: statusCounts.running },
                { label: "Done", value: statusCounts.done },
              ]} height={160} />
            </Card>
            <Card>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Department totals vs the vision</div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Department</th><th className="py-1 text-right">Allocation</th><th className="py-1 text-right">Activities expect</th><th className="py-1 text-right">Dept planned</th><th className="py-1 text-right">KPI actual</th></tr></thead>
                <tbody>
                  {moduleRows.map((r) => (
                    <tr key={r.slug} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-1.5">{moduleName(r.slug)}</td>
                      <td className="py-1.5 text-right">{r.allocation ? formatINR(r.allocation) : "—"}</td>
                      <td className="py-1.5 text-right">{formatINR(r.value)}{r.allocation > 0 && <span className="ml-1 text-xs text-slate-400">({planProgressPct(r.value, r.allocation)}%)</span>}</td>
                      <td className="py-1.5 text-right">{r.deptBudget ? formatINR(r.deptBudget) : "—"}</td>
                      <td className="py-1.5 text-right">{r.kpiActual != null ? `${r.kpiActual}${r.kpiTarget ? ` / ${r.kpiTarget}` : ""}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          {/* Per-activity variance: master vs amended vs actual */}
          <Card>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Per-activity variance — master (directors) vs amended (managers) vs actual</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-1 pr-2">Activity</th><th className="py-1 pr-2">Department</th><th className="py-1 pr-2">Status</th>
                    <th className="py-1 pr-2 text-right">Master count</th><th className="py-1 pr-2 text-right">Amended count</th>
                    <th className="py-1 pr-2 text-right">Master cost</th><th className="py-1 pr-2 text-right">Amended cost</th>
                    <th className="py-1 pr-2 text-right">Cost variance</th><th className="py-1 pr-2 text-right">Actual cost</th><th className="py-1 text-right">Actual vs master</th>
                  </tr>
                </thead>
                <tbody>
                  {visionActivities.length === 0 && <tr><td className="py-2 text-slate-400" colSpan={10}>No vision activities yet.</td></tr>}
                  {visionActivities.map((va) => {
                    const ad = adopted.get(va.id)!;
                    const status = visionActivityStatus(ad);
                    const v = varianceRow(va, ad);
                    return (
                      <tr key={va.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="py-1.5 pr-2 font-medium">{va.name}</td>
                        <td className="py-1.5 pr-2 text-slate-500">{moduleName(va.moduleSlug)}</td>
                        <td className="py-1.5 pr-2"><Badge tone={status === "done" ? "green" : status === "running" ? "blue" : "amber"}>{status}</Badge></td>
                        <td className="py-1.5 pr-2 text-right">{va.count}</td>
                        <td className="py-1.5 pr-2 text-right">{ad.plans ? ad.target : "—"}</td>
                        <td className="py-1.5 pr-2 text-right">{formatINR(va.expectedCost)}</td>
                        <td className="py-1.5 pr-2 text-right">{ad.plans ? formatINR(ad.budget) : "—"}</td>
                        <td className={`py-1.5 pr-2 text-right ${v.costVariance != null && v.costVariance > 0 ? "text-red-700" : "text-slate-600"}`}>{fmtVar(v.costVariance, v.costVariancePct)}</td>
                        <td className="py-1.5 pr-2 text-right">{ad.actualCost != null ? formatINR(ad.actualCost) : "—"}</td>
                        <td className={`py-1.5 text-right ${ad.actualCost != null && ad.actualCost > va.expectedCost ? "text-red-700" : "text-slate-600"}`}>{ad.actualCost != null ? fmtVar(ad.actualCost - va.expectedCost, va.expectedCost > 0 ? Math.round(((ad.actualCost - va.expectedCost) / va.expectedCost) * 1000) / 10 : null) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Amended figures are the managers&apos; plan activities linked to each vision activity. Actual cost is captured today for completed camps and mobile-clinic routes linked to the activity; other actuals appear as they are captured.</p>
          </Card>
        </>
      )}
    </main>
  );
}
