import Link from "next/link";
import { redirect } from "next/navigation";
import { formatINR, isBranchScoped, isCompanyScoped } from "@prm/core";
import { requireCan } from "@/lib/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { DottedAccent } from "@/components/DottedAccent";
import { companiesWithCentres, centreSetSummary, planTargetRollup, plansBudget } from "@/lib/consolidation/rollup";
import { activityMonitor, type MonitorCounts } from "@/lib/consolidation/activityMonitor";
import { costCentres, financeTotals, unattributedCampaignSpend } from "@/lib/consolidation/finance";

export const dynamic = "force-dynamic";

/** Company header row + indented centre rows for the approval-pipeline table. */
function CompanyMonitorRows({ name, counts, centres }: {
  name: string;
  counts: MonitorCounts;
  centres: { branchId: string | null; name: string; counts: MonitorCounts }[];
}) {
  const cells = (c: MonitorCounts) => (
    <>
      <td className="py-1.5 text-right">{c.total}</td>
      <td className="py-1.5 text-right">{c.entered + c.verified > 0 ? <span className="font-medium text-amber-700">{c.entered + c.verified}</span> : 0}</td>
      <td className="py-1.5 text-right">{c.approved}</td>
      <td className="py-1.5 text-right">{c.inProgress} / {c.done}</td>
    </>
  );
  return (
    <>
      <tr className="border-t border-slate-200 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-800/60">
        <td className="py-1.5 font-semibold">{name}</td>
        {cells(counts)}
      </tr>
      {centres.map((r) => (
        <tr key={r.branchId ?? "company-plan"} className="border-t border-slate-100 dark:border-slate-700">
          <td className="py-1.5 pl-4 text-slate-600 dark:text-slate-300">{r.name}</td>
          {cells(r.counts)}
        </tr>
      ))}
    </>
  );
}

/**
 * Group business consolidation: both companies side by side plus group totals.
 * Arithmetic ties out by construction — group figures are counted over the
 * union of every company's centres, the same sets the company pages use.
 */
export default async function GroupPage() {
  const user = await requireCan("dashboards", "view");
  // Company managers consolidate at their company, not the group; centre-pinned
  // roles have no org-level view at all.
  if (isCompanyScoped(user.role) && user.companyId) redirect(`/company/${user.companyId}`);
  if (isBranchScoped(user.role)) redirect("/");

  const companies = await companiesWithCentres();
  const allIds = companies.flatMap((c) => c.centres.map((b) => b.id));
  const [groupSummary, groupRollups, perCompany, monitor, campaignSpend] = await Promise.all([
    centreSetSummary(allIds),
    planTargetRollup(allIds),
    Promise.all(companies.map(async (c) => {
      const ids = c.centres.map((b) => b.id);
      const [summary, rollups, finance] = await Promise.all([
        centreSetSummary(ids),
        planTargetRollup(ids),
        costCentres(c.centres.map((b) => ({ id: b.id, name: b.name, type: b.type }))),
      ]);
      return { company: c, summary, budget: plansBudget(rollups), finance: financeTotals(finance) };
    })),
    activityMonitor(),
    unattributedCampaignSpend(),
  ]);
  // Group money strip = Σ company totals (ties out with each company page).
  const groupFinance = financeTotals(perCompany.map((p) => ({ ...p.finance, id: p.company.id, name: p.company.name, type: "company" })));
  const idList = allIds.join(",");

  return (
    <main>
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-7">
        <DottedAccent className="opacity-70" />
        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Sreedhareeyam Group</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Group business consolidation</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
          Both companies, every centre — targets planned centre-by-centre, consolidated per company, rolled up for the group.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Companies</div><div className="mt-1 text-2xl font-bold">{companies.length}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Centres</div><div className="mt-1 text-2xl font-bold">{allIds.length}</div></Card>
        <DrillStat label="Leads" value={groupSummary.leads} entity="leads" filters={{ branchId: idList }} />
        <DrillStat label="Consultations" value={groupSummary.consultations} entity="consultations" filters={{ branchId: idList }} />
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Σ planned budget</div><div className="mt-1 text-2xl font-bold">{formatINR(plansBudget(groupRollups))}</div></Card>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Group spend (outreach actuals)</div><div className="mt-1 text-2xl font-bold">{formatINR(groupFinance.spend)}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Group revenue</div><div className="mt-1 text-2xl font-bold">{formatINR(groupFinance.revenue)}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Group net</div><div className={`mt-1 text-2xl font-bold ${groupFinance.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatINR(groupFinance.net)}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Unattributed marketing spend</div><div className="mt-1 text-2xl font-bold">{formatINR(campaignSpend)}</div><div className="text-[11px] text-slate-400">Campaign budgets — no centre attribution</div></Card>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        {perCompany.map(({ company, summary, budget, finance }) => (
          <Card key={company.id} accent>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <Link href={`/company/${company.id}`} className="text-lg font-bold hover:underline">{company.shortName ?? company.name}</Link>
                <div className="text-xs text-slate-500">{company.name}</div>
              </div>
              {company.code && <Badge tone="blue">{company.code}</Badge>}
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Centres</div><div className="font-semibold">{company.centres.length}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Leads</div><div className="font-semibold">{summary.leads}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Consults</div><div className="font-semibold">{summary.consultations}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Budget</div><div className="font-semibold">{formatINR(budget)}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Planned</div><div className="font-semibold">{formatINR(finance.planned)}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Spend</div><div className="font-semibold">{formatINR(finance.spend)}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Revenue</div><div className="font-semibold">{formatINR(finance.revenue)}</div></div>
              <div className="rounded border border-slate-100 px-2 py-1.5 dark:border-slate-700"><div className="text-[11px] uppercase text-slate-400">Net</div><div className={`font-semibold ${finance.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatINR(finance.net)}</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {company.centres.map((b) => <Badge key={b.id} tone={b.type === "flagship_hospital" ? "green" : b.type === "op_centre" ? "amber" : "slate"}>{b.name}</Badge>)}
            </div>
            <div className="mt-3 text-sm"><Link href={`/company/${company.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">Company consolidation →</Link></div>
          </Card>
        ))}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Activity monitor</h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge tone="amber">entered {monitor.totals.entered}</Badge>
            <Badge tone="blue">verified {monitor.totals.verified}</Badge>
            <Badge tone="green">approved {monitor.totals.approved}</Badge>
            <Badge tone="red">rejected {monitor.totals.rejected}</Badge>
            <Badge tone="slate">in progress {monitor.totals.inProgress}</Badge>
            <Badge tone="slate">done {monitor.totals.done}</Badge>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Approval pipeline by company &amp; centre</div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Plan scope</th><th className="py-1 text-right">Activities</th><th className="py-1 text-right">Pending</th><th className="py-1 text-right">Approved</th><th className="py-1 text-right">In prog / done</th></tr></thead>
              <tbody>
                {monitor.byCompany.length === 0 && <tr><td className="py-2 text-slate-400" colSpan={5}>No active plan activities anywhere.</td></tr>}
                {monitor.byCompany.map((cm) => (
                  <CompanyMonitorRows key={cm.companyId ?? "group"} name={cm.companyName} counts={cm.counts} centres={cm.centres} />
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Awaiting verification / approval (oldest first)</div>
            <div className="space-y-1.5">
              {monitor.pendingQueue.length === 0 && <p className="text-sm text-slate-400">Nothing waiting — all activities are approved or rejected.</p>}
              {monitor.pendingQueue.map((r) => (
                <Link key={`${r.planId}:${r.index}`} href={`/modules/${r.moduleSlug}/plan`} className="block rounded border border-slate-100 px-3 py-1.5 text-sm transition-colors hover:border-rose-300 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.title}</span>
                    <Badge tone={r.approval === "verified" ? "blue" : "amber"}>{r.approval === "verified" ? "needs approval" : "needs verification"}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">{r.moduleName} · {r.centreName ?? (r.scope === "company" ? "Company plan" : "Group plan")}{r.companyName ? ` · ${r.companyName}` : ""}{r.ownerName ? ` · owner ${r.ownerName}` : ""}{r.enteredAt ? ` · entered ${r.enteredAt.slice(0, 10)}` : ""}</div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
        <Card>
          <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Recent activity changes</div>
          <ul className="space-y-1 text-sm">
            {monitor.recentChanges.length === 0 && <li className="text-slate-400">No changes logged yet.</li>}
            {monitor.recentChanges.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 border-t border-slate-100 py-1 first:border-t-0 dark:border-slate-700">
                <span className="text-xs text-slate-400">{c.at.slice(0, 16).replace("T", " ")}</span>
                <span className="font-medium">{c.byName ?? "—"}</span>
                <span>{c.action}</span>
                <span className="text-slate-500">{c.moduleName} · {c.planTitle}{c.centreName ? ` · ${c.centreName}` : ""}</span>
                {c.detail && <span className="text-xs text-slate-400">{c.detail}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Leads by company</div>
          <BarChartCard data={perCompany.map(({ company, summary }) => ({ label: company.code ?? company.name, value: summary.leads }))} height={150} />
        </Card>
        <Card>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Consultations by company</div>
          <BarChartCard data={perCompany.map(({ company, summary }) => ({ label: company.code ?? company.name, value: summary.consultations }))} height={150} alt />
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Group target rollup — active centre plans</h2>
        {groupRollups.length === 0 ? (
          <Card><p className="text-sm text-slate-400">No active centre plans anywhere yet.</p></Card>
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Module</th><th className="py-1 text-right">Centre plans</th><th className="py-1 text-right">Σ budget</th><th className="py-1">Targets (actual / target)</th></tr></thead>
              <tbody>
                {groupRollups.map((r) => (
                  <tr key={r.moduleSlug} className="border-t border-slate-100 align-top dark:border-slate-700">
                    <td className="py-1.5"><Link href={`/modules/${r.moduleSlug}/plan`} className="hover:underline">{r.moduleName}</Link></td>
                    <td className="py-1.5 text-right">{r.plans}</td>
                    <td className="py-1.5 text-right">{formatINR(r.plannedBudget)}</td>
                    <td className="py-1.5">
                      {r.targets.map((t, i) => (
                        <span key={i} className="mr-3 whitespace-nowrap">{t.label}: <b>{t.actual != null ? `${t.actual} / ` : ""}{t.target}</b></span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </main>
  );
}
