import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recomputeKpis } from "@/lib/analytics/actions";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { conversionRate } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const money = (p: number | null) => (p === null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);

export default async function Analytics() {
  await requireCan("dashboards", "view");

  const [branches, doctors, campaigns, retention, lastRollup] = await Promise.all([
    prisma.branch.findMany({ where: { active: true } }),
    prisma.doctor.findMany({ where: { active: true } }),
    prisma.campaign.findMany(),
    prisma.retentionStatus.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.branchKPI.findFirst({ orderBy: { periodEnd: "desc" } }),
  ]);

  const branchRows = await Promise.all(branches.map(async (b) => {
    const [leads, appointments, consultations] = await Promise.all([
      prisma.lead.count({ where: { branchId: b.id } }),
      prisma.opBooking.count({ where: { branchId: b.id } }),
      prisma.consultation.count({ where: { branchId: b.id } }),
    ]);
    return { name: b.name, leads, appointments, consultations, conv: conversionRate(consultations, leads) };
  }));

  const today = new Date(new Date().toISOString().slice(0, 10));
  const doctorRows = await Promise.all(doctors.map(async (d) => {
    const [consultations, admissionsRec, noShows, completedToday] = await Promise.all([
      prisma.consultation.count({ where: { doctorId: d.id } }),
      prisma.admissionRecommendation.count({ where: { doctorId: d.id } }),
      prisma.opBooking.count({ where: { doctorId: d.id, status: "no_show" } }),
      prisma.opBooking.count({ where: { doctorId: d.id, appointmentDate: today, status: "completed" } }),
    ]);
    const target = d.dailyTarget ?? null;
    const targetCell = target === null ? "—" : `${completedToday}/${target}${completedToday >= target ? " ✓" : ""}`;
    return { name: d.name, consultations, admissionsRec, noShows, targetCell };
  }));

  const campaignRows = (await Promise.all(campaigns.map(async (c) => ({ name: c.name, k: await computeCampaignKpis(c.id, c.budget) }))))
    .sort((a, b) => (b.k.roi ?? -Infinity) - (a.k.roi ?? -Infinity));

  const retentionCount = (c: string) => retention.find((r) => r.category === c)?._count._all ?? 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Branch & doctor performance, campaign ROI, retention (§5)"
        action={<form action={recomputeKpis}><SubmitButton tone="ghost">Materialise KPI rollups</SubmitButton></form>}
      />
      {lastRollup && <p className="mb-4 text-xs text-slate-400">Rollup tables last materialised for period ending {lastRollup.periodEnd.toISOString().slice(0, 10)} (for BI export).</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {["active", "at_risk", "dormant", "lost", "reactivated"].map((c) => (
          <Card key={c}><div className="text-2xl font-bold">{retentionCount(c)}</div><div className="text-xs text-slate-500">{c.replace(/_/g, " ")}</div></Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Branch performance" head={["Branch", "Leads", "Appts", "Consults", "Conv"]} rows={branchRows.map((r) => [r.name, r.leads, r.appointments, r.consultations, `${r.conv}%`])} />
        <Panel title="Doctor performance (Today vs target)" head={["Doctor", "Today/target", "Consults", "Adm. rec", "No-shows"]} rows={doctorRows.map((r) => [r.name, r.targetCell, r.consultations, r.admissionsRec, r.noShows])} />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Campaign ROI</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Campaign</th><th className="px-4 py-2">Spend</th><th className="px-4 py-2">Leads</th><th className="px-4 py-2">Admits</th><th className="px-4 py-2">Revenue</th><th className="px-4 py-2">ROI</th></tr></thead>
          <tbody>
            {campaignRows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No campaigns.</td></tr>}
            {campaignRows.map((r) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.name}</td><td className="px-4 py-2">{money(r.k.spend)}</td><td className="px-4 py-2">{r.k.leads}</td><td className="px-4 py-2">{r.k.admissions}</td><td className="px-4 py-2">{money(r.k.revenue)}</td>
                <td className="px-4 py-2">{r.k.roi === null ? "—" : <Badge tone={r.k.roi >= 0 ? "green" : "red"}>{r.k.roi}%</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Panel({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{head.map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-slate-400">No data.</td></tr>}
            {rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
