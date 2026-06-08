import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, conversionRate } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { leadFunnel } from "@/lib/leads/funnel";
import { allExecutiveFunnels } from "@/lib/callcenter/metrics";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";

export const dynamic = "force-dynamic";

const CONVERTED = ["appointment_booked", "converted_to_patient"];

export default async function LeadReport() {
  const user = await requireCan("reports", "view");
  const scope = branchScopeWhere(user.role, user.branchId);

  const [funnel, sources, branches, campaigns, execs] = await Promise.all([
    leadFunnel(scope),
    prisma.leadSourceMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    allExecutiveFunnels(),
  ]);

  // Lead source breakdown.
  const sourceRows = await Promise.all(sources.map(async (s) => ({
    id: s.id, name: s.name.replace(/_/g, " "), group: s.group ?? "—",
    leads: await prisma.lead.count({ where: { ...scope, sourceId: s.id, mergedIntoId: null } }),
  })));
  const sourceRowsNonZero = sourceRows.filter((r) => r.leads > 0).sort((a, b) => b.leads - a.leads);

  // Branch performance.
  const branchRows = await Promise.all(branches.map(async (b) => {
    const [leads, converted, appts] = await Promise.all([
      prisma.lead.count({ where: { branchId: b.id, mergedIntoId: null } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.lead.count({ where: { branchId: b.id, stage: { in: CONVERTED as any } } }),
      prisma.opBooking.count({ where: { branchId: b.id } }),
    ]);
    return { id: b.id, name: b.name, leads, appts, conversion: conversionRate(converted, leads) };
  }));

  // Campaign ROI.
  const campaignRows = await Promise.all(campaigns.map(async (c) => ({ id: c.id, name: c.name, ...(await computeCampaignKpis(c.id, c.budget ?? 0)) })));

  const inr = (paise: number) => `₹${Math.round((paise ?? 0) / 100).toLocaleString("en-IN")}`;
  const th = "px-4 py-2 font-medium";
  const td = "px-4 py-2";

  return (
    <div>
      <PageHeader title="Lead Management report" subtitle="Funnel · source · executive · branch · campaign ROI (Module 1 §16)" />
      <div className="mb-4"><Link href="/reports" className="text-sm text-slate-500 hover:underline">← Reports</Link></div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Conversion funnel</h2>
        <Card><LeadFunnelChart stages={funnel} /></Card>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Leads by source</h2>
          <Card>
            <BarChartCard data={sourceRowsNonZero.map((r) => ({ label: r.name, value: r.leads }))} />
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={th}>Source</th><th className={th}>Group</th><th className={th}>Leads</th></tr></thead>
                <tbody>
                  {sourceRowsNonZero.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className={`${td} capitalize`}>{r.name}</td>
                      <td className={`${td} capitalize text-slate-500`}>{r.group.replace(/_/g, " ")}</td>
                      <td className={td}><DrillCount value={r.leads} entity="leads" filters={{ sourceId: r.id }} label={`Leads · ${r.name}`} /></td>
                    </tr>
                  ))}
                  {sourceRowsNonZero.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No leads.</td></tr>}
                </tbody>
              </table>
            </div>
            <Link href="/api/reports/export?type=leads-by-source" className="mt-2 inline-block text-xs text-rose-600 hover:underline dark:text-rose-300">Export CSV ↓</Link>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Executive performance</h2>
          <Card>
            <BarChartCard data={execs.map((e) => ({ label: e.name, value: e.leads }))} alt />
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={th}>Executive</th><th className={th}>Leads</th><th className={th}>Calls</th><th className={th}>Appts</th><th className={th}>Conv.</th></tr></thead>
                <tbody>
                  {execs.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className={td}>{e.name}</td>
                      <td className={td}><DrillCount value={e.leads} entity="leads" filters={{ ownerId: e.id }} label={`Leads · ${e.name}`} /></td>
                      <td className={`${td} text-slate-600 dark:text-slate-300`}>{e.calls}</td>
                      <td className={`${td} text-slate-600 dark:text-slate-300`}>{e.appointments}</td>
                      <td className={td}><Badge tone={e.conversion >= 30 ? "green" : "amber"}>{e.conversion}%</Badge></td>
                    </tr>
                  ))}
                  {execs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Branch performance</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={th}>Branch</th><th className={th}>Leads</th><th className={th}>Appointments</th><th className={th}>Conversion</th></tr></thead>
              <tbody>
                {branchRows.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className={td}>{b.name}</td>
                    <td className={td}><DrillCount value={b.leads} entity="leads" filters={{ branchId: b.id }} label={`Leads · ${b.name}`} /></td>
                    <td className={td}><DrillCount value={b.appts} entity="appointments" filters={{ branchId: b.id }} label={`Appointments · ${b.name}`} /></td>
                    <td className={td}><Badge tone={b.conversion >= 30 ? "green" : "amber"}>{b.conversion}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Campaign ROI</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={th}>Campaign</th><th className={th}>Spend</th><th className={th}>Leads</th><th className={th}>Admits</th><th className={th}>Revenue</th><th className={th}>ROI</th></tr></thead>
              <tbody>
                {campaignRows.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className={td}><Link href={`/campaigns/${c.id}`} className="text-rose-700 hover:underline dark:text-rose-300">{c.name}</Link></td>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>{inr(c.spend)}</td>
                    <td className={td}><DrillCount value={c.leads} entity="leads" filters={{ campaignId: c.id }} label={`Leads · ${c.name}`} /></td>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>{c.admissions}</td>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>{inr(c.revenue)}</td>
                    <td className={td}><Badge tone={(c.roi ?? 0) >= 0 ? "green" : "red"}>{c.roi ?? 0}%</Badge></td>
                  </tr>
                ))}
                {campaignRows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No campaigns.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
