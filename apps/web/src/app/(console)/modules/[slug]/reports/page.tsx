import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getModuleBySlug, resolveFilters } from "@/lib/modules/registry";
import { drillCount } from "@/lib/drill/count";
import { getPlanConfig } from "@/lib/config/actions";
import { formatINR, type ActivityLine } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";
import { renderCell } from "@/components/masters/renderCell";

export const dynamic = "force-dynamic";

export default async function ModuleReports({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireCan(def.resource, "view");

  // Reuse the module's own KPI definitions as report rows — each is a real count
  // with the same drill-through the dashboards use, so no bespoke queries needed.
  const [rows, cfg, plans] = await Promise.all([
    Promise.all(
      def.kpis.map(async (k) => {
        const filters = resolveFilters(k.filters);
        const value = await drillCount(k.entity, filters, user);
        return { label: k.label, value, entity: k.entity, filters };
      }),
    ),
    getPlanConfig(slug),
    prisma.modulePlan.findMany({ where: { moduleSlug: slug }, orderBy: { createdAt: "desc" } }),
  ]);
  const activePlan = plans.find((p) => p.status === "active") ?? plans[0] ?? null;
  const activities: ActivityLine[] = Array.isArray(activePlan?.activities) ? (activePlan!.activities as unknown as ActivityLine[]) : [];

  return (
    <div>
      <PageHeader title={`${def.name} · Reports`} subtitle={`Key metrics for the ${def.name} department`} />

      <div className="mb-6 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {def.name} metrics
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-slate-400">No metrics configured for this module.</td></tr>}
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">{r.label}</td>
                <td className="px-4 py-2 text-right font-medium">
                  <DrillCount value={r.value} entity={r.entity} filters={r.filters} label={`${def.name} · ${r.label}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Plan activity report — standard columns + admin-configured report columns. */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Plan activities {activePlan?.period ? `· ${activePlan.period}` : ""}</span>
          <Link href={`/modules/${slug}/configure`} className="text-xs text-rose-600 hover:underline">Configure columns →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Activity</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Budget</th>
              {cfg.reportColumns.map((c) => <th key={c.name} className="px-4 py-2 font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 && <tr><td colSpan={4 + cfg.reportColumns.length} className="px-4 py-3 text-slate-400">No plan activities yet.</td></tr>}
            {activities.map((a, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">{a.title}</td>
                <td className="px-4 py-2"><Badge tone={a.approval?.status === "approved" ? "green" : a.approval?.status === "verified" ? "blue" : a.approval?.status === "rejected" ? "red" : "amber"}>{a.approval?.status ?? "entered"}</Badge></td>
                <td className="px-4 py-2">{a.target ?? "—"}</td>
                <td className="px-4 py-2">{a.budget ? formatINR(a.budget) : "—"}</td>
                {cfg.reportColumns.map((c) => <td key={c.name} className="px-4 py-2">{renderCell(a.custom?.[c.name], c.name)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Looking for the workspace? <Link href={`/modules/${def.slug}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">Open the {def.name} dashboard →</Link>
        </div>
      </Card>
    </div>
  );
}
