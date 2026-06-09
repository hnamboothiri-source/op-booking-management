import Link from "next/link";
import { requireCan } from "@/lib/session";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { executiveProductivity } from "@/lib/retention/metrics";

export const dynamic = "force-dynamic";

export default async function RetentionExecutives() {
  await requireCan("retention", "view");
  const rows = await executiveProductivity();
  const totals = rows.reduce((a, r) => ({ assigned: a.assigned + r.assigned, contacted: a.contacted + r.contacted, reactivated: a.reactivated + r.reactivated }), { assigned: 0, contacted: 0, reactivated: 0 });

  return (
    <div>
      <PageHeader title="Patient-success executives" subtitle="Reactivation productivity per owner (Module 12)" action={<LinkButton href="/retention" tone="ghost">← Retention</LinkButton>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{rows.length}</div><div className="text-xs text-slate-500">Executives</div></Card>
        <Card><div className="text-2xl font-bold">{totals.assigned}</div><div className="text-xs text-slate-500">Assigned patients</div></Card>
        <Card><div className="text-2xl font-bold text-blue-600">{totals.contacted}</div><div className="text-xs text-slate-500">Contacted</div></Card>
        <Card><div className="text-2xl font-bold text-emerald-600">{totals.reactivated}</div><div className="text-xs text-slate-500">Reactivated</div></Card>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-2">Executive</th><th className="px-4 py-2 text-right">Assigned</th><th className="px-4 py-2 text-right">Contacted</th><th className="px-4 py-2 text-right">Reactivated</th><th className="px-4 py-2 text-right">Conversion</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-slate-400">No assigned patients yet. Assign success owners on the retention worklist.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id || "none"} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2"><Link href={`/retention?successOwnerId=${encodeURIComponent(r.id)}`} className="text-rose-700 hover:underline dark:text-rose-300">{r.name}</Link></td>
                <td className="px-4 py-2 text-right">{r.assigned}</td>
                <td className="px-4 py-2 text-right text-blue-600">{r.contacted}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{r.reactivated}</td>
                <td className="px-4 py-2 text-right font-medium">{r.conversionPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
