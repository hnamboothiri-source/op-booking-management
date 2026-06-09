import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, formatINR, type PlvTier } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";
import { DEFAULT_RETENTION_THRESHOLDS, PLV_TIER_TONE } from "@prm/core";
import { saveRetentionRules } from "@/lib/retention/actions";
import { plvRanking, retentionRate, repeatVisitRate, doctorWiseRetention } from "@/lib/retention/metrics";

export const dynamic = "force-dynamic";

export default async function RetentionReports() {
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");

  const [rate, repeat, ltv, doctors, dormant, reactivated, rulesRec] = await Promise.all([
    retentionRate(),
    repeatVisitRate(),
    plvRanking(15),
    doctorWiseRetention(),
    prisma.retentionStatus.findMany({ where: { category: { in: ["dormant", "lost"] } }, include: { patient: true }, take: 50 }).catch(() => [] as { patientMrd: string; category: string; riskScore: number; patient: { name: string } }[]),
    prisma.retentionStatus.findMany({ where: { category: "reactivated" }, include: { patient: true }, take: 50 }).catch(() => [] as { patientMrd: string; reactivatedAt: Date | null; reactivationResult: string | null; patient: { name: string } }[]),
    prisma.customRecord.findFirst({ where: { moduleSlug: "retention", masterKey: "retention-rules" } }).catch(() => null),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = ((rulesRec?.data ?? null) as any) ?? DEFAULT_RETENTION_THRESHOLDS;

  return (
    <div>
      <PageHeader title="Retention reports" subtitle="Retention rate, LTV ranking, doctor-wise retention & dormant/reactivated lists" action={<LinkButton href="/retention" tone="ghost">← Retention</LinkButton>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold text-emerald-600">{rate.ratePct}%</div><div className="text-xs text-slate-500">Retention rate</div></Card>
        <Card><div className="text-2xl font-bold">{repeat.pct}%</div><div className="text-xs text-slate-500">Repeat-visit rate ({repeat.repeat}/{repeat.total})</div></Card>
        <Card><div className="text-2xl font-bold text-amber-600">{rate.lost}</div><div className="text-xs text-slate-500">Lost patients</div></Card>
        <Card><div className="text-2xl font-bold text-emerald-600">{rate.reactivated}</div><div className="text-xs text-slate-500">Reactivated</div></Card>
      </div>

      {/* Rules engine config */}
      <Card>
        <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Retention rules (days since last visit)</div>
        {canEdit ? (
          <form action={saveRetentionRules} className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col">At-risk ≥<input type="number" name="atRiskDays" defaultValue={Number(rules.atRiskDays) || 90} className="w-24 rounded border border-slate-300 px-2 py-1" /></label>
            <label className="flex flex-col">Dormant ≥<input type="number" name="dormantDays" defaultValue={Number(rules.dormantDays) || 180} className="w-24 rounded border border-slate-300 px-2 py-1" /></label>
            <label className="flex flex-col">Lost ≥<input type="number" name="lostDays" defaultValue={Number(rules.lostDays) || 365} className="w-24 rounded border border-slate-300 px-2 py-1" /></label>
            <SubmitButton>Save rules</SubmitButton>
            <span className="text-xs text-slate-400">Recompute on the retention page to re-apply.</span>
          </form>
        ) : (
          <p className="text-sm text-slate-600">At-risk ≥ {Number(rules.atRiskDays) || 90}d · Dormant ≥ {Number(rules.dormantDays) || 180}d · Lost ≥ {Number(rules.lostDays) || 365}d</p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* LTV ranking */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Lifetime value ranking</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Tier</th><th className="px-4 py-2 text-right">Consult</th><th className="px-4 py-2 text-right">Medicine</th><th className="px-4 py-2 text-right">Therapy</th><th className="px-4 py-2 text-right">Package</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
            <tbody>
              {ltv.length === 0 && <tr><td colSpan={7} className="px-4 py-3 text-slate-400">No data.</td></tr>}
              {ltv.map((p) => (
                <tr key={p.mrd} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2"><Link href={`/retention/${encodeURIComponent(p.mrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{p.name}</Link></td>
                  <td className="px-4 py-2"><Badge tone={PLV_TIER_TONE[p.tier as PlvTier]}>{p.tier}</Badge></td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatINR(p.consultation)}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatINR(p.medicine)}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatINR(p.therapy)}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatINR(p.package)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatINR(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Doctor-wise retention */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Doctor-wise retention</div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Doctor</th><th className="px-4 py-2 text-right">Patients</th><th className="px-4 py-2 text-right">Retained</th><th className="px-4 py-2 text-right">Lost</th><th className="px-4 py-2 text-right">%</th></tr></thead>
            <tbody>
              {doctors.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-slate-400">No consultations linked.</td></tr>}
              {doctors.map((d) => (
                <tr key={d.doctorId} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2 text-right">{d.patients}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{d.retained}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{d.lost}</td>
                  <td className="px-4 py-2 text-right font-medium">{d.retainedPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dormant list */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Dormant / lost ({dormant.length})</div>
          <table className="w-full text-sm">
            <tbody>
              {dormant.length === 0 && <tr><td className="px-4 py-3 text-slate-400">None.</td></tr>}
              {dormant.map((s) => (
                <tr key={s.patientMrd} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2"><Link href={`/retention/${encodeURIComponent(s.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{s.patient.name}</Link></td>
                  <td className="px-4 py-2"><Badge tone={s.category === "lost" ? "red" : "amber"}>{s.category}</Badge></td>
                  <td className="px-4 py-2 text-right text-slate-500">risk {s.riskScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reactivated list */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Reactivated ({reactivated.length})</div>
          <table className="w-full text-sm">
            <tbody>
              {reactivated.length === 0 && <tr><td className="px-4 py-3 text-slate-400">None yet.</td></tr>}
              {reactivated.map((s) => (
                <tr key={s.patientMrd} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2"><Link href={`/retention/${encodeURIComponent(s.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{s.patient.name}</Link></td>
                  <td className="px-4 py-2 text-slate-500">{s.reactivationResult?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{s.reactivatedAt ? new Date(s.reactivatedAt).toISOString().slice(0, 10) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
