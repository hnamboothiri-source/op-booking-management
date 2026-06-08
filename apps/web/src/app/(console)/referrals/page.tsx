import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createReferral, updateReferralStatus } from "@/lib/referrals/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillStat } from "@/components/drill/DrillStat";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";

const TYPES = ["patient_to_patient", "doctor", "hospital", "branch", "camp", "corporate", "institutional"];
const STATUSES = ["pending", "consulted", "admitted", "lost"];
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function Referrals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("referrals", "view");
  const canEdit = can(user.role, "referrals", "edit");
  const filters = listFilters("referrals", await searchParams);

  const [refs, orgs, topReferrers, statusGroups, revAgg] = await Promise.all([
    prisma.referral.findMany({ where: DRILL.referrals.buildWhere(filters), include: { referrerPatient: true, referredPatient: true, organization: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.referral.groupBy({ by: ["referrerPatientMrd"], _count: { _all: true }, where: { referrerPatientMrd: { not: null } } }),
    prisma.referral.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.referral.aggregate({ _sum: { revenue: true } }),
  ]);
  const cnt = (s: string) => statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const total = statusGroups.reduce((a, g) => a + g._count._all, 0);
  const consulted = cnt("consulted") + cnt("admitted");
  const admitted = cnt("admitted");
  const revenue = revAgg._sum.revenue ?? 0;

  return (
    <div>
      <PageHeader title="Referral management" subtitle="Track patient & doctor referrals and conversion (Module 6)" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Referrals" value={total} entity="referrals" filters={{}} />
        <DrillStat label="Consulted" value={consulted} entity="referrals" filters={{ status: "consulted,admitted" }} />
        <DrillStat label="Admitted" value={admitted} entity="referrals" filters={{ status: "admitted" }} />
        <Card><div className="text-2xl font-bold">₹{(revenue / 100).toLocaleString("en-IN")}</div><div className="text-xs text-slate-500 dark:text-slate-400">Attributed revenue</div></Card>
      </div>

      <ActiveFilters filters={filters} basePath="/referrals" />

      {can(user.role, "referrals", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New referral</h2>
          <form action={createReferral} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">Type<select name="type" className={input}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Referrer patient MRD<input name="referrerPatientMrd" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">External referrer name<input name="referrerName" placeholder="doctor / contact" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Organization<select name="organizationId" className={input}><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Referred patient MRD<input name="referredPatientMrd" className={input} /></label>
            <label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" name="rewardEligible" className="h-4 w-4" /> Reward eligible</label>
            <div className="col-span-2 sm:col-span-3"><SubmitButton>Add referral</SubmitButton></div>
          </form>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Type</th><th className="px-4 py-2">Referrer</th><th className="px-4 py-2">Referred</th><th className="px-4 py-2">Status</th>{canEdit && <th className="px-4 py-2"></th>}</tr></thead>
            <tbody>
              {refs.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-slate-400">No referrals yet.</td></tr>}
              {refs.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{r.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">{r.referrerPatient?.name ?? r.referrerName ?? r.organization?.name ?? "—"}</td>
                  <td className="px-4 py-2">{r.referredPatient?.name ?? (r.referredPatientMrd ?? "—")}</td>
                  <td className="px-4 py-2"><Badge tone={r.status === "admitted" ? "green" : r.status === "lost" ? "red" : "blue"}>{r.status}</Badge></td>
                  {canEdit && (
                    <td className="px-4 py-2">
                      <form action={updateReferralStatus.bind(null, r.id)} className="flex items-center gap-1">
                        <select name="status" defaultValue={r.status} className="rounded border border-slate-300 px-1 py-0.5 text-xs">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                        <input name="revenue" placeholder="₹" className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                        <button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Save</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Top referring patients</h3>
          {topReferrers.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
            <ul className="space-y-1 text-sm">
              {topReferrers.sort((a, b) => b._count._all - a._count._all).slice(0, 8).map((t) => (
                <li key={t.referrerPatientMrd} className="flex justify-between"><Link href={`/patients/${encodeURIComponent(t.referrerPatientMrd!)}`} className="text-rose-700 hover:underline">{t.referrerPatientMrd}</Link><span className="font-medium">{t._count._all}</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
