import { requireCan } from "@/lib/session";
import { formatINR } from "@prm/core";
import { outreachAnalytics, type FunnelCounts } from "@/lib/outreach/metrics";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";

export const dynamic = "force-dynamic";

export default async function OutreachDashboard() {
  await requireCan("reports", "view");
  const a = await outreachAnalytics();
  const t = a.totals;

  const stat = (label: string, value: React.ReactNode) => (
    <Card><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500 dark:text-slate-400">{label}</div></Card>
  );
  const cols: { key: keyof FunnelCounts; label: string; money?: boolean }[] = [
    { key: "screened", label: "Screened" }, { key: "recommended", label: "Recommended" },
    { key: "appointments", label: "Appts" }, { key: "consultations", label: "Consults" },
    { key: "treatments", label: "Treatments" }, { key: "admissions", label: "Admits" },
    { key: "revenue", label: "Revenue", money: true },
  ];
  const cell = (c: FunnelCounts, k: keyof FunnelCounts, money?: boolean) => (money ? (c[k] ? formatINR(c[k]) : "—") : c[k]);

  return (
    <div>
      <PageHeader title="Outreach dashboard" subtitle="Camps + mobile clinics — acquisition funnel, geo & staff" action={<LinkButton href="/outreach/reports" tone="ghost">Budget / ROI →</LinkButton>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {stat("Camps", t.camps)}
        {stat("Routes", t.mobiles)}
        {stat("Screened", t.screened)}
        {stat("Leads", t.leads)}
        {stat("Appointments", t.appointments)}
        {stat("Consultations", t.consultations)}
        {stat("Admissions", t.admissions)}
        {stat("Revenue", formatINR(t.revenue))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Camp funnel</h3><LeadFunnelChart stages={a.funnelCamp} /></Card>
        <Card><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Mobile clinic funnel</h3><LeadFunnelChart stages={a.funnelMobile} /></Card>
      </div>

      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Camp vs Mobile clinic</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Channel</th>{cols.map((c) => <th key={c.key} className="px-4 py-2 text-right">{c.label}</th>)}</tr></thead>
          <tbody>
            {a.byType.map((r) => (
              <tr key={r.type} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2 font-medium">{r.type}</td>
                {cols.map((c) => <td key={c.key} className="px-4 py-2 text-right">{cell(r.counts, c.key, c.money)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GeoTable title="Location performance" rows={a.byLocation} cols={cols} cell={cell} />
        <GeoTable title="District performance" rows={a.byDistrict} cols={cols} cell={cell} />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Staff performance (screened → conversions)</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Staff</th>{cols.map((c) => <th key={c.key} className="px-4 py-2 text-right">{c.label}</th>)}</tr></thead>
          <tbody>
            {a.byStaff.length === 0 && <tr><td colSpan={cols.length + 1} className="px-4 py-3 text-slate-400">No screening attribution yet.</td></tr>}
            {a.byStaff.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                {cols.map((c) => <td key={c.key} className="px-4 py-2 text-right">{cell(r.counts, c.key, c.money)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GeoTable({ title, rows, cols, cell }: {
  title: string;
  rows: { key: string; counts: FunnelCounts }[];
  cols: { key: keyof FunnelCounts; label: string; money?: boolean }[];
  cell: (c: FunnelCounts, k: keyof FunnelCounts, money?: boolean) => React.ReactNode;
}) {
  const slim = cols.filter((c) => ["screened", "admissions", "revenue"].includes(c.key));
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Area</th>{slim.map((c) => <th key={c.key} className="px-4 py-2 text-right">{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={slim.length + 1} className="px-4 py-3 text-slate-400">No data.</td></tr>}
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100 dark:border-slate-700">
              <td className="px-4 py-2">{r.key}</td>
              {slim.map((c) => <td key={c.key} className="px-4 py-2 text-right">{cell(r.counts, c.key, c.money)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
