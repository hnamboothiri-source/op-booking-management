import { requireUser } from "@/lib/session";
import { canUseTool } from "@/lib/tools";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { recomputeKpis } from "@/lib/analytics/actions";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { conversionRate } from "@prm/core";
import { PageHeader, Badge, SubmitButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { DrillCount } from "@/components/drill/DrillCount";
import Link from "next/link";

export const dynamic = "force-dynamic";
const money = (p: number | null) => (p === null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);

export default async function Analytics() {
  { const u = await requireUser(); if (!canUseTool(u, "analytics", "dashboards")) redirect("/forbidden"); }

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
    return { id: b.id, name: b.name, leads, appointments, consultations, conv: conversionRate(consultations, leads) };
  }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  const doctorRows = await Promise.all(doctors.map(async (d) => {
    const [consultations, admissionsRec, noShows, completedToday] = await Promise.all([
      prisma.consultation.count({ where: { doctorId: d.id } }),
      prisma.admissionRecommendation.count({ where: { doctorId: d.id } }),
      prisma.opBooking.count({ where: { doctorId: d.id, status: "no_show" } }),
      prisma.opBooking.count({ where: { doctorId: d.id, appointmentDate: today, status: "completed" } }),
    ]);
    const target = d.dailyTarget ?? null;
    const targetCell = target === null ? "—" : `${completedToday}/${target}${completedToday >= target ? " ✓" : ""}`;
    return { id: d.id, name: d.name, consultations, admissionsRec, noShows, targetCell };
  }));

  const campaignRows = (await Promise.all(campaigns.map(async (c) => ({ id: c.id, name: c.name, k: await computeCampaignKpis(c.id, c.budget) }))))
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
          <DrillStat key={c} label={c.replace(/_/g, " ")} value={retentionCount(c)} entity="retention" filters={{ category: c }} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Branch performance"
          head={["Branch", "Leads", "Appts", "Consults", "Conv"]}
          rows={branchRows.map((r) => [
            r.name,
            <DrillCount value={r.leads} entity="leads" filters={{ branchId: r.id }} label={`${r.name} · leads`} />,
            <DrillCount value={r.appointments} entity="appointments" filters={{ branchId: r.id }} label={`${r.name} · appointments`} />,
            <DrillCount value={r.consultations} entity="consultations" filters={{ branchId: r.id }} label={`${r.name} · consultations`} />,
            `${r.conv}%`,
          ])}
        />
        <Panel
          title="Doctor performance (Today vs target)"
          head={["Doctor", "Today/target", "Consults", "Adm. rec", "No-shows"]}
          rows={doctorRows.map((r) => [
            r.name,
            <DrillCount value={r.targetCell} entity="appointments" filters={{ doctorId: r.id, date: todayStr, status: "completed" }} label={`${r.name} · completed today`} />,
            <DrillCount value={r.consultations} entity="consultations" filters={{ doctorId: r.id }} label={`${r.name} · consultations`} />,
            <DrillCount value={r.admissionsRec} entity="admissions" filters={{ doctorId: r.id }} label={`${r.name} · admission recs`} />,
            <DrillCount value={r.noShows} entity="appointments" filters={{ doctorId: r.id, status: "no_show" }} label={`${r.name} · no-shows`} />,
          ])}
        />
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Campaign ROI</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-2">Campaign</th><th className="px-4 py-2">Spend</th><th className="px-4 py-2">Leads</th><th className="px-4 py-2">Admits</th><th className="px-4 py-2">Revenue</th><th className="px-4 py-2">ROI</th></tr></thead>
          <tbody>
            {campaignRows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No campaigns.</td></tr>}
            {campaignRows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2"><Link href={`/campaigns/${r.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-400">{r.name}</Link></td>
                <td className="px-4 py-2">{money(r.k.spend)}</td>
                <td className="px-4 py-2"><DrillCount value={r.k.leads} entity="leads" filters={{ campaignId: r.id }} label={`${r.name} · leads`} /></td>
                <td className="px-4 py-2">{r.k.admissions}</td><td className="px-4 py-2">{money(r.k.revenue)}</td>
                <td className="px-4 py-2">{r.k.roi === null ? "—" : <Badge tone={r.k.roi >= 0 ? "green" : "red"}>{r.k.roi}%</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Panel({ title, head, rows }: { title: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{head.map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-slate-400">No data.</td></tr>}
            {rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-700">{r.map((c, j) => <td key={j} className="px-4 py-2">{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
