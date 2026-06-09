import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, formatINR, REFERRER_TYPE_LABELS, REFERRER_INTERACTION_TYPES, type ReferrerType } from "@prm/core";
import { updateReferrer, logReferrerInteraction } from "@/lib/referrals/actions";
import { referrerKpis, traceReferral } from "@/lib/referrals/metrics";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default async function ReferrerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("referrals", "view");
  const canEdit = can(user.role, "referrals", "edit");

  const referrer = await prisma.referrer.findUnique({ where: { id }, include: { relationManager: true } });
  if (!referrer) notFound();

  // Children queried separately (mock include is a no-op for reverse relations).
  const [kpis, referrals, interactions, staff] = await Promise.all([
    referrerKpis(id),
    prisma.referral.findMany({ where: { referrerId: id }, include: { referredPatient: true }, orderBy: { createdAt: "desc" } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.referrerInteraction.findMany({ where: { referrerId: id } as any, orderBy: { at: "desc" } }).catch(() => [] as Record<string, unknown>[]),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const traces = await Promise.all(referrals.map((r) => traceReferral(r)));
  const factors = (referrer.scoreFactors as Record<string, number> | null) ?? kpis.factors;

  const stat = (label: string, value: React.ReactNode) => (
    <Card><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500 dark:text-slate-400">{label}</div></Card>
  );

  return (
    <div>
      <PageHeader
        title={referrer.name as string}
        subtitle={`${REFERRER_TYPE_LABELS[referrer.type as ReferrerType]}${referrer.specialty ? ` · ${referrer.specialty}` : ""}${referrer.hospitalName ? ` · ${referrer.hospitalName}` : ""}`}
        action={<LinkButton href="/referrals/referrers" tone="ghost">← Referrers</LinkButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stat("Referrals", kpis.referrals)}
        {stat("Appointments", kpis.appointments)}
        {stat("Consultations", kpis.consultations)}
        {stat("Admissions", kpis.admissions)}
        {stat("Attributed revenue", formatINR(kpis.revenue))}
        <Card accent><div className="text-2xl font-bold">{kpis.score}</div><div className="text-xs text-slate-500 dark:text-slate-400">Referrer score</div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Their referrals + computed conversion */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Referrals from this referrer</div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Referred</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Appts</th><th className="px-4 py-2 text-right">Consults</th><th className="px-4 py-2 text-right">Revenue</th></tr></thead>
              <tbody>
                {referrals.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">No referrals yet.</td></tr>}
                {referrals.map((r, i) => (
                  <tr key={r.id as string} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2">{(r.referredPatient as { name?: string } | null)?.name ?? r.referredPatientMrd ?? "—"}</td>
                    <td className="px-4 py-2"><Badge tone={r.status === "admitted" ? "green" : r.status === "lost" ? "red" : "blue"}>{r.status as string}</Badge></td>
                    <td className="px-4 py-2 text-right">{traces[i].appointments}</td>
                    <td className="px-4 py-2 text-right">{traces[i].consultations}</td>
                    <td className="px-4 py-2 text-right">{traces[i].revenue ? formatINR(traces[i].revenue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Relationship interaction log */}
          <Card>
            <h3 className="font-semibold">Relationship log</h3>
            {canEdit && (
              <form action={logReferrerInteraction.bind(null, id)} className="mt-2 flex flex-wrap items-end gap-2">
                <label className={lab}>Type<select name="type" className={input}>{REFERRER_INTERACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
                <label className={`${lab} flex-1`}>Outcome *<input name="outcome" required placeholder="What came out of it" className={input} /></label>
                <label className={lab}>Next follow-up<input type="date" name="nextFollowUp" className={input} /></label>
                <SubmitButton tone="ghost">Log</SubmitButton>
              </form>
            )}
            <div className="mt-3 space-y-1">
              {interactions.length === 0 ? <p className="text-sm text-slate-400">No interactions logged.</p> : interactions.map((e) => (
                <div key={e.id as string} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <span><Badge tone="slate">{String(e.type).replace(/_/g, " ")}</Badge> <span className="ml-2">{e.outcome as string}</span>{e.notes ? <span className="text-slate-400"> — {e.notes as string}</span> : ""}</span>
                  <span className="text-xs text-slate-400">{iso(e.at as Date)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Score breakdown */}
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Score breakdown</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(factors).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>
              ))}
              <div className="mt-1 flex justify-between border-t border-slate-100 pt-1"><span className="font-semibold">Total</span><span className="font-bold">{kpis.score}/100</span></div>
            </div>
          </Card>

          {/* Details + relationship manager */}
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Details</h3>
            <div className="space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
              <div>Phone: {(referrer.phone as string) ?? "—"}</div>
              <div>Email: {(referrer.email as string) ?? "—"}</div>
              <div>Location: {(referrer.location as string) ?? "—"}</div>
              <div>Manager: {(referrer.relationManager as { name?: string } | null)?.name ?? "—"}</div>
              <div>Last meeting: {iso(referrer.lastMeetingDate as Date | null)}</div>
              <div>Next follow-up: {iso(referrer.nextFollowUp as Date | null)}</div>
            </div>
            {canEdit && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-400">Edit details</summary>
                <form action={updateReferrer.bind(null, id)} className="mt-2 space-y-2">
                  <label className={`${lab} block`}>Name<input name="name" defaultValue={referrer.name as string} className={input} /></label>
                  <label className={`${lab} block`}>Specialty<input name="specialty" defaultValue={(referrer.specialty as string) ?? ""} className={input} /></label>
                  <label className={`${lab} block`}>Hospital / clinic<input name="hospitalName" defaultValue={(referrer.hospitalName as string) ?? ""} className={input} /></label>
                  <label className={`${lab} block`}>Phone<input name="phone" defaultValue={(referrer.phone as string) ?? ""} className={input} /></label>
                  <label className={`${lab} block`}>Email<input name="email" defaultValue={(referrer.email as string) ?? ""} className={input} /></label>
                  <label className={`${lab} block`}>Location<input name="location" defaultValue={(referrer.location as string) ?? ""} className={input} /></label>
                  <label className={`${lab} block`}>Relationship manager<select name="relationManagerId" defaultValue={(referrer.relationManagerId as string) ?? ""} className={input}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                  <label className={`${lab} flex items-center gap-2`}><input type="checkbox" name="active" defaultChecked={Boolean(referrer.active)} className="h-4 w-4" /> Active</label>
                  <SubmitButton>Save</SubmitButton>
                </form>
              </details>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
