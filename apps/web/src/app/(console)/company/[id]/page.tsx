import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatINR, isBranchScoped, isCompanyScoped, planProgressPct } from "@prm/core";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { leadFunnel } from "@/lib/leads/funnel";
import { centrePerformance, centreSetSummary, planTargetRollup, companyPlanRollup, plansBudget } from "@/lib/consolidation/rollup";
import { costCentres, financeTotals } from "@/lib/consolidation/finance";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  flagship_hospital: "Flagship",
  hospital: "Hospital",
  op_centre: "OP centre",
};

/**
 * Company consolidation: every centre of one legal entity — headline KPIs,
 * per-centre performance, and the rollup of the centres' own plans (targets
 * summed, actuals counted across the same centres).
 */
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("dashboards", "view");
  // A company manager may only open their own company's consolidation; centre-
  // pinned roles have no company-level view.
  if (isCompanyScoped(user.role) && user.companyId && user.companyId !== id) redirect(`/company/${user.companyId}`);
  if (isBranchScoped(user.role)) redirect("/");

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) notFound();
  const branches = await prisma.branch.findMany({ where: { companyId: id, active: true }, orderBy: { name: "asc" } });
  const centres = branches.map((b) => ({ id: b.id, name: b.name, type: String(b.type ?? "hospital") }));
  const ids = centres.map((c) => c.id);
  const idList = ids.join(",");

  const [summary, perf, rollups, companyPlans, stages, finance] = await Promise.all([
    centreSetSummary(ids),
    centrePerformance(centres),
    planTargetRollup(ids),
    companyPlanRollup(id, ids),
    leadFunnel(ids.length ? { branchId: { in: ids } } : {}),
    costCentres(centres),
  ]);
  const finTotal = financeTotals(finance);

  return (
    <main>
      <PageHeader title={company.shortName ?? company.name} subtitle={company.name} />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/group" className="text-slate-500 hover:underline">← Group consolidation</Link>
        {company.code && <Badge tone="blue">{company.code}</Badge>}
        <Badge tone="slate">{centres.length} centre{centres.length === 1 ? "" : "s"}</Badge>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DrillStat label="Leads" value={summary.leads} entity="leads" filters={{ branchId: idList }} />
        <DrillStat label="Appointments" value={summary.appointments} entity="appointments" filters={{ branchId: idList }} />
        <DrillStat label="Consultations" value={summary.consultations} entity="consultations" filters={{ branchId: idList }} />
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversion</div><div className="mt-1 text-2xl font-bold">{summary.conv}%</div></Card>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Centre performance</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Centre</th><th className="py-1">Type</th><th className="py-1 text-right">Leads</th><th className="py-1 text-right">Appts</th><th className="py-1 text-right">Consults</th><th className="py-1 text-right">Conv%</th></tr></thead>
            <tbody>
              {perf.length === 0 && <tr><td className="py-2 text-slate-400" colSpan={6}>No centres.</td></tr>}
              {perf.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5">{r.name}</td>
                  <td className="py-1.5"><Badge tone={r.type === "flagship_hospital" ? "green" : r.type === "op_centre" ? "amber" : "slate"}>{TYPE_LABEL[r.type] ?? r.type}</Badge></td>
                  <td className="py-1.5 text-right">{r.leads}</td>
                  <td className="py-1.5 text-right">{r.appointments}</td>
                  <td className="py-1.5 text-right">{r.consultations}</td>
                  <td className="py-1.5 text-right font-medium">{r.conv}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card accent>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Lead conversion funnel — all centres</div>
          <LeadFunnelChart stages={stages} />
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Company business plan</h2>
          <span className="text-sm text-slate-500">Σ planned budget {formatINR(plansBudget(companyPlans))}</span>
        </div>
        {companyPlans.length === 0 ? (
          <Card><p className="text-sm text-slate-400">No company-level plan yet — set the centre switcher to “All centres” and create one on a module&apos;s Plan page. It governs centres that don&apos;t have their own plan.</p></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {companyPlans.map((r) => (
              <Card key={r.moduleSlug} accent>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <Link href={`/modules/${r.moduleSlug}/plan`} className="font-semibold hover:underline">{r.title ?? r.moduleName}</Link>
                    <div className="text-xs text-slate-500">{r.moduleName}{r.period ? ` · ${r.period}` : ""}{r.objective ? ` — ${r.objective}` : ""}</div>
                  </div>
                  <span className="text-xs text-slate-500">{formatINR(r.plannedBudget)}</span>
                </div>
                <div className="space-y-2">
                  {r.targets.length === 0 && <p className="text-sm text-slate-400">No targets set.</p>}
                  {r.targets.map((t, i) => {
                    const pct = t.actual != null ? planProgressPct(t.actual, t.target) : null;
                    return (
                      <div key={i} className="rounded border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{t.label}</span>
                          <span>{t.actual != null ? `${t.actual} / ` : ""}{t.target}{t.unit ? ` ${t.unit}` : ""}{pct != null ? ` · ${pct}%` : ""}</span>
                        </div>
                        {pct != null && <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100"><div className="h-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cost centres</h2>
          <span className="text-xs text-slate-400">Planned = plan + activity budgets · Spend = outreach actuals · Revenue = consultation fees + on-site + admitted packages</span>
        </div>
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Cost centre</th><th className="py-1">Type</th><th className="py-1 text-right">Planned</th><th className="py-1 text-right">Spend</th><th className="py-1 text-right">Revenue</th><th className="py-1 text-right">Net</th><th className="py-1 text-right">Vs plan</th></tr></thead>
            <tbody>
              {finance.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5">{r.name}</td>
                  <td className="py-1.5"><Badge tone={r.type === "flagship_hospital" ? "green" : r.type === "op_centre" ? "amber" : "slate"}>{TYPE_LABEL[r.type] ?? r.type}</Badge></td>
                  <td className="py-1.5 text-right">{formatINR(r.planned)}</td>
                  <td className="py-1.5 text-right">{formatINR(r.spend)}</td>
                  <td className="py-1.5 text-right">{formatINR(r.revenue)}</td>
                  <td className={`py-1.5 text-right font-medium ${r.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatINR(r.net)}</td>
                  <td className={`py-1.5 text-right ${r.variance > 0 ? "text-red-700" : "text-slate-500"}`}>{r.variance > 0 ? `+${formatINR(r.variance)}` : formatINR(r.variance)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold dark:border-slate-500">
                <td className="py-1.5">Company total</td>
                <td />
                <td className="py-1.5 text-right">{formatINR(finTotal.planned)}</td>
                <td className="py-1.5 text-right">{formatINR(finTotal.spend)}</td>
                <td className="py-1.5 text-right">{formatINR(finTotal.revenue)}</td>
                <td className={`py-1.5 text-right ${finTotal.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatINR(finTotal.net)}</td>
                <td className="py-1.5 text-right">{finTotal.variance > 0 ? `+${formatINR(finTotal.variance)}` : formatINR(finTotal.variance)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-400">Admitted package values are estimates until billing; marketing campaign spend is reported at group level (no centre attribution).</p>
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Centre plans — consolidated targets</h2>
          <span className="text-sm text-slate-500">Σ planned budget {formatINR(plansBudget(rollups))}</span>
        </div>
        {rollups.length === 0 ? (
          <Card><p className="text-sm text-slate-400">No active centre plans yet. Each centre creates its own plan on a module&apos;s Plan page (pick the centre in the header switcher).</p></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rollups.map((r) => (
              <Card key={r.moduleSlug}>
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/modules/${r.moduleSlug}/plan`} className="font-semibold hover:underline">{r.moduleName}</Link>
                  <span className="text-xs text-slate-500">{r.plans} centre plan{r.plans === 1 ? "" : "s"} · {formatINR(r.plannedBudget)}</span>
                </div>
                <div className="space-y-2">
                  {r.targets.length === 0 && <p className="text-sm text-slate-400">No targets in these plans.</p>}
                  {r.targets.map((t, i) => {
                    const pct = t.actual != null ? planProgressPct(t.actual, t.target) : null;
                    return (
                      <div key={i} className="rounded border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{t.label}</span>
                          <span>{t.actual != null ? `${t.actual} / ` : ""}{t.target}{t.unit ? ` ${t.unit}` : ""}{pct != null ? ` · ${pct}%` : ""}</span>
                        </div>
                        {pct != null && <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100"><div className="h-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <Card>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Consultations by centre</div>
          <BarChartCard data={perf.map((r) => ({ label: r.name, value: r.consultations }))} height={Math.max(150, perf.length * 32)} alt />
        </Card>
      </section>
    </main>
  );
}
