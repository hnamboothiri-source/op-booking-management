import Link from "next/link";
import { requireCan } from "@/lib/session";
import { formatINR, REFERRER_TYPE_LABELS, type ReferrerType } from "@prm/core";
import { referralFunnel, topReferrers, revenueBySource } from "@/lib/referrals/metrics";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";

export const dynamic = "force-dynamic";

export default async function ReferralReports() {
  await requireCan("referrals", "view");
  const [funnel, top, bySource] = await Promise.all([referralFunnel(), topReferrers(undefined, 10), revenueBySource()]);

  return (
    <div>
      <PageHeader title="Referral reports" subtitle="Funnel, top referrers & revenue by source" action={<LinkButton href="/referrals" tone="ghost">← Referrals</LinkButton>} />

      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Referral funnel</h2>
        <Card><LeadFunnelChart stages={funnel} /><p className="mt-2 text-xs text-slate-400">Received → appointment → consultation → treatment → admission (traced from each referral).</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Top referrers</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Referrer</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Refs</th><th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2 text-right">Score</th></tr></thead>
            <tbody>
              {top.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">No referrers yet.</td></tr>}
              {top.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2"><Link href={`/referrals/referrers/${r.id}`} className="text-rose-700 hover:underline dark:text-rose-400">{r.name}</Link></td>
                  <td className="px-4 py-2 text-slate-600">{REFERRER_TYPE_LABELS[r.type as ReferrerType]}</td>
                  <td className="px-4 py-2 text-right">{r.referrals}</td>
                  <td className="px-4 py-2 text-right">{r.revenue ? formatINR(r.revenue) : "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Revenue by source</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Source</th><th className="px-4 py-2 text-right">Referrals</th><th className="px-4 py-2 text-right">Revenue</th></tr></thead>
            <tbody>
              {bySource.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400">No referrals yet.</td></tr>}
              {bySource.map((s) => (
                <tr key={s.source} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2">{s.label}</td>
                  <td className="px-4 py-2 text-right">{s.referrals}</td>
                  <td className="px-4 py-2 text-right">{s.revenue ? formatINR(s.revenue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
