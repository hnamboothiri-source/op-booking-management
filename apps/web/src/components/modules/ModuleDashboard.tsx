import Link from "next/link";
import { branchScopeWhere, can, type RoleName } from "@prm/core";
import { PageHeader, Card } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { BarChartCard } from "@/components/charts/BarChartCard";
import { leadFunnel } from "@/lib/leads/funnel";
import { drillCount } from "@/lib/drill/count";
import { resolveFilters, type ModuleDef } from "@/lib/modules/registry";

async function FeatureSection({ def, role, branchId }: { def: ModuleDef; role: RoleName; branchId: string | null }) {
  if (def.feature === "leadFunnel") {
    const stages = await leadFunnel(branchScopeWhere(role, branchId));
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Lead conversion funnel</h2>
        <Card>
          <LeadFunnelChart stages={stages} />
          <p className="mt-2 text-xs text-slate-400">Click a stage to preview the records behind it.</p>
        </Card>
      </section>
    );
  }
  if (def.feature === "apptFlow") {
    const today = resolveFilters({ date: "$today" });
    const [booked, arrivedAll, completed] = await Promise.all([
      drillCount("appointments", { ...today, status: "booked,confirmed" }, role, branchId),
      drillCount("appointments", { ...today, status: "arrived,waiting,in_consultation,completed" }, role, branchId),
      drillCount("appointments", { ...today, status: "completed" }, role, branchId),
    ]);
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Today&apos;s flow</h2>
        <Card>
          <BarChartCard data={[{ label: "Booked", value: booked + arrivedAll }, { label: "Arrived", value: arrivedAll }, { label: "Completed", value: completed }]} height={150} />
        </Card>
      </section>
    );
  }
  return null;
}

/** Generic per-module dashboard: KPI tiles + optional feature chart + workspace cards. */
export async function ModuleDashboard({ def, role, branchId }: { def: ModuleDef; role: RoleName; branchId: string | null }) {
  const kpiValues = await Promise.all(def.kpis.map((k) => drillCount(k.entity, resolveFilters(k.filters), role, branchId)));
  const cards = def.links.filter((c) => can(role, c.resource, c.action ?? "view"));

  return (
    <div>
      <PageHeader title={def.name} subtitle={def.subtitle} />

      {def.kpis.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {def.kpis.map((k, i) => (
            <DrillStat key={k.label} label={k.label} value={kpiValues[i]} entity={k.entity} filters={resolveFilters(k.filters)} />
          ))}
        </div>
      )}

      <FeatureSection def={def} role={role} branchId={branchId} />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspaces</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700">
            <div className="flex items-center gap-1 font-semibold text-slate-800 group-hover:text-rose-700 dark:text-slate-100 dark:group-hover:text-rose-300">{c.label}<span className="opacity-0 transition-opacity group-hover:opacity-100">→</span></div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
