import Link from "next/link";
import { MODULE_DASHBOARDS, resolveFilters } from "@/lib/modules/registry";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, conversionRate, roiPct, type DrillEntity, type DrillFilters } from "@prm/core";
import { userScopeWhere } from "@/lib/scope";
import { accessibleModules, isModuleManager } from "@/lib/modules/access";
import { allowedModuleSlugsFor } from "@/lib/modules/allotment";
import type { CurrentUser } from "@/lib/session";
import { DrillStat } from "@/components/drill/DrillStat";
import { DrillCount } from "@/components/drill/DrillCount";
import { Card } from "@/components/ui";
import { ModuleLauncherCard } from "@/components/modules/ModuleLauncherCard";
import { DottedAccent } from "@/components/DottedAccent";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { leadFunnel } from "@/lib/leads/funnel";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { drillCount } from "@/lib/drill/count";

const money = (p: number | null) => (p === null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);

async function ManagementKpis({ user }: { user: CurrentUser }) {
  const scope = await userScopeWhere(user);
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  const [totalLeads, converted, apptToday, completed, admissionsRec, pendingFu, dormant] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, stage: { in: ["appointment_booked", "converted_to_patient"] } } }),
    prisma.opBooking.count({ where: { ...scope, appointmentDate: today } }),
    prisma.opBooking.count({ where: { ...scope, status: "completed" } }),
    prisma.admissionRecommendation.count(),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] } } }),
    prisma.patient.count({ where: { category: "dormant" } }),
  ]);
  const tiles: { label: string; value: React.ReactNode; entity: DrillEntity; filters: DrillFilters }[] = [
    { label: "Total leads", value: totalLeads, entity: "leads", filters: {} },
    { label: "Lead conversion", value: `${conversionRate(converted, totalLeads)}%`, entity: "leads", filters: { stage: "appointment_booked,converted_to_patient" } },
    { label: "Appointments today", value: apptToday, entity: "appointments", filters: { date: todayStr } },
    { label: "Consultations completed", value: completed, entity: "appointments", filters: { status: "completed" } },
    { label: "Admissions recommended", value: admissionsRec, entity: "admissions", filters: {} },
    { label: "Pending follow-ups", value: pendingFu, entity: "followups", filters: { status: "pending,booked" } },
    { label: "Dormant patients", value: dormant, entity: "patients", filters: { category: "dormant" } },
  ];
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">Management overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((t) => <DrillStat key={t.label} label={t.label} value={t.value} entity={t.entity} filters={t.filters} />)}
      </div>
    </section>
  );
}

async function Departments({ user }: { user: CurrentUser }) {
  const visible = accessibleModules(user, await allowedModuleSlugsFor(user));
  // Resolve up to 3 KPIs per module in one parallel pass.
  const cards = await Promise.all(
    visible.map(async (m) => {
      const picks = m.kpis.slice(0, 3);
      const values = await Promise.all(picks.map((k) => drillCount(k.entity, resolveFilters(k.filters), user)));
      return { def: m, kpis: picks.map((k, i) => ({ label: k.label, value: values[i] })) };
    }),
  );
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">Departments</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => <ModuleLauncherCard key={c.def.id} def={c.def} kpis={c.kpis} />)}
      </div>
    </section>
  );
}

async function Performance({ user }: { user: CurrentUser }) {
  const scope = await userScopeWhere(user);
  // The branch table follows the same org scope (one centre, a company's
  // centres, or all centres).
  const branchWhere = scope.branchId ? { active: true, id: scope.branchId } : { active: true };
  const [stages, branches, retention, campaigns] = await Promise.all([
    leadFunnel(scope),
    prisma.branch.findMany({ where: branchWhere, orderBy: { name: "asc" } }),
    prisma.retentionStatus.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.campaign.findMany(),
  ]);

  const branchRows = await Promise.all(branches.map(async (b) => {
    const [leads, appointments, consultations] = await Promise.all([
      prisma.lead.count({ where: { branchId: b.id } }),
      prisma.opBooking.count({ where: { branchId: b.id } }),
      prisma.consultation.count({ where: { branchId: b.id } }),
    ]);
    return { name: b.name, leads, appointments, consultations, conv: conversionRate(consultations, leads) };
  }));

  const retentionData = retention.map((r) => ({ label: String(r.category).replace(/_/g, " "), value: r._count._all }));

  const campRows = (await Promise.all(campaigns.map(async (c) => {
    const k = await computeCampaignKpis(c.id, c.budget, c.launchedAt);
    return { name: c.name, leads: k.leads, spend: c.budget, roi: roiPct(k.revenue, c.budget) };
  })))
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
    .slice(0, 5);

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance</h2>
        <div className="flex gap-3 text-sm">
          <Link href="/analytics" className="text-rose-700 hover:underline dark:text-rose-300">Analytics →</Link>
          <Link href="/reports" className="text-rose-700 hover:underline dark:text-rose-300">Reports →</Link>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card accent>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Lead conversion funnel</div>
          <LeadFunnelChart stages={stages} />
        </Card>
        <Card accent>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Retention mix</div>
          <BarChartCard data={retentionData} height={180} alt />
        </Card>
        <Card>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Branch performance</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Branch</th><th className="py-1 text-right">Leads</th><th className="py-1 text-right">Appts</th><th className="py-1 text-right">Consults</th><th className="py-1 text-right">Conv%</th></tr></thead>
            <tbody>
              {branchRows.length === 0 && <tr><td className="py-2 text-slate-400" colSpan={5}>No data.</td></tr>}
              {branchRows.map((r) => (
                <tr key={r.name} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5">{r.name}</td>
                  <td className="py-1.5 text-right">{r.leads}</td>
                  <td className="py-1.5 text-right">{r.appointments}</td>
                  <td className="py-1.5 text-right">{r.consultations}</td>
                  <td className="py-1.5 text-right font-medium">{r.conv}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Top campaigns by ROI</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Campaign</th><th className="py-1 text-right">Leads</th><th className="py-1 text-right">Spend</th><th className="py-1 text-right">ROI</th></tr></thead>
            <tbody>
              {campRows.length === 0 && <tr><td className="py-2 text-slate-400" colSpan={4}>No campaigns.</td></tr>}
              {campRows.map((r) => (
                <tr key={r.name} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5">{r.name}</td>
                  <td className="py-1.5 text-right">{r.leads}</td>
                  <td className="py-1.5 text-right">{money(r.spend)}</td>
                  <td className="py-1.5 text-right font-medium">{r.roi === null ? "—" : `${r.roi}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}

async function DoctorToday() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  const worklist = "booked,confirmed,arrived,waiting,in_consultation";
  const appts = await prisma.opBooking.findMany({
    where: { appointmentDate: today, status: { in: ["booked", "confirmed", "arrived", "waiting", "in_consultation"] } },
    include: { patient: true, doctor: true },
    orderBy: { startTime: "asc" },
    take: 50,
  });
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">
        Today&apos;s clinic (<DrillCount value={appts.length} entity="appointments" filters={{ date: todayStr, status: worklist }} label="Today's clinic" />)
      </h2>
      <div className="space-y-1">
        {appts.length === 0 && <p className="text-sm text-slate-400">No appointments today.</p>}
        {appts.map((a) => (
          <div key={a.id} className="flex justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span>{a.startTime} · {a.patient.name} · {a.doctor.name}</span><span className="text-slate-500">{a.status.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function Dashboard() {
  const user = await requireUser();
  const moduleManager = isModuleManager(user);
  // Cross-module rollups (lead funnel, campaigns, branch perf) are for org-wide
  // managers; a department manager only sees the departments they own.
  const showOrgRollup = !moduleManager && can(user.role, "dashboards", "view");
  return (
    <main>
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-7">
        <DottedAccent className="opacity-70" />
        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Welcome, {user.name} · {user.role.replace(/_/g, " ")}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{moduleManager ? "My departments" : "Consolidated dashboard"}</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
          {moduleManager
            ? "The departments you manage — open one for its dashboard, activities & reports."
            : "A single rollup across every module — open any department in the sidebar for its own dashboard & workspaces."}
        </p>
      </header>

      {showOrgRollup && <ManagementKpis user={user} />}
      {user.role === "doctor" && <DoctorToday />}
      <Departments user={user} />
      {showOrgRollup && <Performance user={user} />}
    </main>
  );
}
