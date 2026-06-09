import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeOutreachKpis, type OutreachEventType } from "@/lib/outreach/metrics";
import {
  budgetTotals, onSiteRevenue, outreachRoi, costPerPatient, expensesByCategory, formatINR,
  type OutreachExpenseLine, type OutreachStaffLine, type OutreachRevenueLine,
} from "@prm/core";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Row {
  id: string; type: OutreachEventType; name: string; recurring: boolean;
  planned: number; actual: number; onSite: number; downstream: number; revenue: number; roi: number | null;
  screened: number; admissions: number; cpp: number | null; marketingActual: number;
  byBranch: Record<string, { admissions: number; revenue: number }>;
}

export default async function OutreachReports() {
  await requireCan("reports", "view");
  const [camps, clinics, branches] = await Promise.all([
    prisma.camp.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.mobileClinic.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.branch.findMany(),
  ]);
  const branchName = (id: string) => (id === "unassigned" ? "Unassigned" : branches.find((b) => b.id === id)?.name ?? id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const build = async (ev: any, type: OutreachEventType): Promise<Row> => {
    const expenses = (ev.expenses as OutreachExpenseLine[] | null) ?? [];
    const roster = (ev.staffRoster as OutreachStaffLine[] | null) ?? [];
    const lines = (ev.revenueLines as OutreachRevenueLine[] | null) ?? [];
    const t = budgetTotals(expenses, roster);
    const onSite = onSiteRevenue(lines);
    const kpis = await computeOutreachKpis(type, ev.id);
    const roi = outreachRoi(t.actualTotal, onSite, kpis.downstreamRevenue);
    const marketingActual = expensesByCategory(expenses).marketing_ads?.actual ?? 0;
    return {
      id: ev.id, type, name: ev.name ?? ev.routeName, recurring: !!ev.isRecurring,
      planned: t.plannedTotal, actual: t.actualTotal, onSite, downstream: kpis.downstreamRevenue,
      revenue: roi.revenue, roi: roi.roi, screened: kpis.screened, admissions: kpis.admissions,
      cpp: costPerPatient(t.actualTotal, kpis.screened), marketingActual, byBranch: kpis.byBranch,
    };
  };

  const rows: Row[] = [
    ...(await Promise.all(camps.map((c) => build(c, "camp")))),
    ...(await Promise.all(clinics.map((c) => build(c, "mobile")))),
  ];

  const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalActual = sum((r) => r.actual);
  const totalRevenue = sum((r) => r.revenue);
  const programRoi = outreachRoi(totalActual, sum((r) => r.onSite), sum((r) => r.downstream));
  const recurringMktg = rows.filter((r) => r.recurring).reduce((s, r) => s + r.marketingActual, 0);
  const oneOffMktg = rows.filter((r) => !r.recurring).reduce((s, r) => s + r.marketingActual, 0);

  // Admissions by branch across all events (merged from the per-row KPIs).
  const byBranch: Record<string, { admissions: number; revenue: number }> = {};
  for (const r of rows) {
    for (const [b, g] of Object.entries(r.byBranch)) {
      const e = (byBranch[b] ??= { admissions: 0, revenue: 0 });
      e.admissions += g.admissions; e.revenue += g.revenue;
    }
  }

  const href = (r: Row) => (r.type === "camp" ? `/camps/${r.id}` : `/mobile-clinics/${r.id}`);

  return (
    <div>
      <PageHeader title="Outreach reports" subtitle="Budget vs spend, ROI & IP admissions by branch — camps + mobile clinics" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card accent><div className="text-[11px] uppercase text-slate-400">Actual spend</div><div className="text-2xl font-bold">{formatINR(totalActual)}</div></Card>
        <Card accent><div className="text-[11px] uppercase text-slate-400">Total revenue</div><div className="text-2xl font-bold text-emerald-600">{formatINR(totalRevenue)}</div></Card>
        <Card accent><div className="text-[11px] uppercase text-slate-400">Net</div><div className="text-2xl font-bold">{formatINR(programRoi.net)}</div></Card>
        <Card accent><div className="text-[11px] uppercase text-slate-400">Program ROI</div><div className="text-2xl font-bold text-emerald-600">{programRoi.roi == null ? "—" : `${programRoi.roi}%`}</div></Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="text-slate-500">Export CSV:</span>
        <a className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50" href="/api/reports/export?type=outreach-budget">Outreach budget</a>
        <a className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50" href="/api/reports/export?type=outreach-roi">Outreach ROI</a>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">Per-event budget & ROI</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr><th className="px-4 py-2">Event</th><th className="px-4 py-2 text-right">Planned</th><th className="px-4 py-2 text-right">Actual</th><th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2 text-right">ROI</th><th className="px-4 py-2 text-right">Screened</th><th className="px-4 py-2 text-right">IP adm.</th><th className="px-4 py-2 text-right">Cost/pt</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No outreach events.</td></tr>}
            {rows.map((r) => (
              <tr key={`${r.type}-${r.id}`} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={href(r)} className="font-medium text-rose-700 hover:underline">{r.name}</Link> <span className="text-xs text-slate-400">{r.type === "camp" ? "camp" : "mobile"}{r.recurring ? " · recurring" : ""}</span></td>
                <td className="px-4 py-2 text-right">{formatINR(r.planned)}</td>
                <td className="px-4 py-2 text-right">{formatINR(r.actual)}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{formatINR(r.revenue)}</td>
                <td className="px-4 py-2 text-right font-medium">{r.roi == null ? "—" : `${r.roi}%`}</td>
                <td className="px-4 py-2 text-right">{r.screened}</td>
                <td className="px-4 py-2 text-right">{r.admissions}</td>
                <td className="px-4 py-2 text-right">{r.cpp == null ? "—" : formatINR(r.cpp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">IP admissions by branch</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Branch</th><th className="py-1 text-right">Admissions</th><th className="py-1 text-right">Value</th></tr></thead>
            <tbody>
              {Object.keys(byBranch).length === 0 && <tr><td colSpan={3} className="py-2 text-slate-400">No downstream admissions yet.</td></tr>}
              {Object.entries(byBranch).map(([b, g]) => (
                <tr key={b} className="border-t border-slate-100"><td className="py-1.5">{branchName(b)}</td><td className="py-1.5 text-right">{g.admissions}</td><td className="py-1.5 text-right">{formatINR(g.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Marketing spend — recurring vs one-off</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded border border-slate-100 px-3 py-2"><span>Recurring camps</span><span className="font-medium">{formatINR(recurringMktg)}</span></div>
            <div className="flex justify-between rounded border border-slate-100 px-3 py-2"><span>One-off camps</span><span className="font-medium">{formatINR(oneOffMktg)}</span></div>
            <p className="text-xs text-slate-400">Recurring camps reuse the same locality &amp; audience, so their marketing spend trends lower per event over time.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
