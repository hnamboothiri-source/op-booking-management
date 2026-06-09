import { outreachRoi, costPerPatient, formatINR } from "@prm/core";
import { Card } from "@/components/ui";
import type { OutreachKpis } from "@/lib/outreach/metrics";

function Tile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
      <div className="h-1 -mx-4 -mt-4 mb-3 rounded-t-2xl bg-gradient-to-r from-rose-600 to-gold-500" />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export function RoiSummary({ plannedTotal, actualTotal, onSite, kpis, branchName }: {
  plannedTotal: number;
  actualTotal: number;
  onSite: number;
  kpis: OutreachKpis;
  branchName: (id: string) => string;
}) {
  const roi = outreachRoi(actualTotal, onSite, kpis.downstreamRevenue);
  const cpp = costPerPatient(actualTotal, kpis.screened);
  const branchRows = Object.entries(kpis.byBranch);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Planned budget" value={formatINR(plannedTotal)} />
        <Tile label="Actual spend" value={formatINR(actualTotal)} />
        <Tile label="On-site revenue" value={formatINR(onSite)} tone="good" />
        <Tile label="Downstream (IP) revenue" value={formatINR(kpis.downstreamRevenue)} tone="good" />
        <Tile label="Net" value={formatINR(roi.net)} tone={roi.net >= 0 ? "good" : "bad"} />
        <Tile label="ROI" value={roi.roi == null ? "—" : `${roi.roi}%`} tone={roi.roi != null && roi.roi >= 0 ? "good" : "bad"} />
        <Tile label="Cost / patient" value={cpp == null ? "—" : formatINR(cpp)} />
        <Tile label="IP admissions" value={String(kpis.admissions)} />
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Downstream funnel (this camp's leads)</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[["Screened", kpis.screened], ["Leads", kpis.leads], ["Consultations", kpis.consultations], ["IP admissions", kpis.admissions]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-rose-50 px-2 py-3">
              <div className="text-2xl font-bold text-slate-900">{v as number}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{l as string}</div>
            </div>
          ))}
        </div>
        {branchRows.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">IP admissions by branch</th><th className="py-1 text-right">Count</th><th className="py-1 text-right">Value</th></tr></thead>
            <tbody>
              {branchRows.map(([b, g]) => (
                <tr key={b} className="border-t border-slate-100"><td className="py-1.5">{b === "unassigned" ? "Unassigned" : branchName(b)}</td><td className="py-1.5 text-right">{g.admissions}</td><td className="py-1.5 text-right">{formatINR(g.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
