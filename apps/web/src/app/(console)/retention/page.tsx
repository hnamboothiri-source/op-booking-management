import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recomputeRetention, assignSuccessOwner, recordReactivationAttempt, launchReactivationCampaign } from "@/lib/retention/actions";
import { can, RETENTION_CONTACT_MODES, RETENTION_OUTCOMES, RETENTION_OUTCOME_LABELS } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillStat } from "@/components/drill/DrillStat";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { approvedActivities } from "@/lib/planning/gate";
import { retentionFunnel, retentionRate } from "@/lib/retention/metrics";

export const dynamic = "force-dynamic";

export default async function Retention({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");
  const filters = listFilters("retention", await searchParams);
  const activeCat = filters.category;
  const hasFilter = Object.keys(filters).length > 0;

  const [statuses, staff, counts, templates, funnel, rate] = await Promise.all([
    prisma.retentionStatus.findMany({ where: hasFilter ? DRILL.retention.buildWhere(filters) : {}, include: { patient: true }, orderBy: { riskScore: "desc" }, take: 300 }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.retentionStatus.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.communicationTemplate.findMany({ orderBy: { name: "asc" } }).catch(() => [] as { id: string; name: string }[]),
    retentionFunnel(),
    retentionRate(),
  ]);
  // Latest attempt date per patient (mock include is a no-op → query separately).
  const activities = await prisma.retentionActivity.findMany({ orderBy: { contactDate: "desc" }, select: { patientMrd: true, contactDate: true } }).catch(() => [] as { patientMrd: string; contactDate: Date }[]);
  const lastAttempt = new Map<string, Date>();
  for (const a of activities) if (!lastAttempt.has(a.patientMrd)) lastAttempt.set(a.patientMrd, a.contactDate);

  const countOf = (c: string) => counts.find((x) => x.category === c)?._count._all ?? 0;
  const owners = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "—";
  const atRisk = statuses.filter((s) => s.category === "at_risk");
  const dormant = statuses.filter((s) => s.category === "dormant" || s.category === "lost");
  const drives = await approvedActivities("retention", "reactivation_drive");

  return (
    <div>
      <PageHeader
        title="Retention & reactivation"
        subtitle="Identify patients who may be lost and bring them back (Module 12)"
        action={
          <div className="flex items-center gap-2">
            <LinkButton href="/retention/worklist" tone="ghost">Worklist</LinkButton>
            <LinkButton href="/retention/campaigns" tone="ghost">Campaigns</LinkButton>
            <LinkButton href="/retention/executives" tone="ghost">Executives</LinkButton>
            <LinkButton href="/retention/reports" tone="ghost">Reports</LinkButton>
            {canEdit && <form action={recomputeRetention}><SubmitButton>Recompute</SubmitButton></form>}
          </div>
        }
      />

      <div className={`mb-6 rounded-xl border px-4 py-2 text-sm ${drives.length ? "border-rose-100 bg-rose-50/60 text-slate-600" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
        {drives.length
          ? <>Reactivations are recorded under the approved drive: <span className="font-medium">{drives.map((d) => d.label).join(", ")}</span>. <Link href="/modules/retention/plan" className="text-rose-700 hover:underline">View plan →</Link></>
          : <>No approved reactivation drive — <Link href="/modules/retention/plan" className="font-medium underline">plan &amp; approve one first →</Link> (reactivations are gated on it).</>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <DrillStat label="Active" value={countOf("active")} entity="retention" filters={{ category: "active" }} />
        <DrillStat label="At risk" value={countOf("at_risk")} entity="retention" filters={{ category: "at_risk" }} />
        <DrillStat label="Dormant" value={countOf("dormant")} entity="retention" filters={{ category: "dormant" }} />
        <DrillStat label="Lost" value={countOf("lost")} entity="retention" filters={{ category: "lost" }} />
        <DrillStat label="Reactivated" value={countOf("reactivated")} entity="retention" filters={{ category: "reactivated" }} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="text-xs font-semibold uppercase text-slate-500">Retention rate</div>
          <div className="mt-1 text-3xl font-bold text-emerald-600">{rate.ratePct}%</div>
          <div className="mt-1 text-xs text-slate-500">{rate.active} active + {rate.reactivated} reactivated of {rate.total}</div>
        </Card>
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Reactivation funnel</div>
          <LeadFunnelChart stages={funnel} />
        </div>
      </div>

      {canEdit && (
        <Card>
          <form action={launchReactivationCampaign} className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">Launch reactivation campaign</div>
              <div className="text-xs text-slate-400">Sends a template to a retention segment (consent-respecting) + logs attempts.</div>
            </div>
            <select name="segment" defaultValue="dormant" className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="at_risk">At-risk</option><option value="dormant">Dormant</option><option value="lost">Lost</option></select>
            <select name="channel" defaultValue="whatsapp" className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select>
            <select name="templateId" defaultValue="" className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="">(no template)</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <SubmitButton>Send campaign</SubmitButton>
          </form>
        </Card>
      )}

      <div className="mt-6" />
      <ActiveFilters filters={filters} basePath="/retention" />

      {statuses.length === 0 && <p className="text-sm text-slate-400">No retention data {activeCat ? "in this category" : "yet"}. {!activeCat && <>Click <strong>Recompute</strong> to evaluate all patients.</>}</p>}

      {activeCat ? (
        statuses.length > 0 && <Section title={`${activeCat.replace(/_/g, " ")} (${statuses.length})`} rows={statuses} staff={staff} canEdit={canEdit} owners={owners} lastAttempt={lastAttempt} />
      ) : (
        <>
          {dormant.length > 0 && <Section title={`Dormant / lost (${dormant.length})`} rows={dormant} staff={staff} canEdit={canEdit} owners={owners} lastAttempt={lastAttempt} />}
          {atRisk.length > 0 && <Section title={`At risk (${atRisk.length})`} rows={atRisk} staff={staff} canEdit={canEdit} owners={owners} lastAttempt={lastAttempt} />}
        </>
      )}
    </div>
  );
}

function Section({ title, rows, staff, canEdit, owners, lastAttempt }: {
  title: string;
  rows: { patientMrd: string; riskScore: number; category: string; successOwnerId: string | null; patient: { name: string } }[];
  staff: { id: string; name: string }[];
  canEdit: boolean;
  owners: (id: string | null) => string;
  lastAttempt: Map<string, Date>;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Risk</th><th className="px-4 py-2">Last attempt</th><th className="px-4 py-2">Success owner</th>{canEdit && <th className="px-4 py-2">Log attempt</th>}</tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.patientMrd} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/retention/${encodeURIComponent(s.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{s.patient.name}</Link></td>
                <td className="px-4 py-2"><Badge tone={s.riskScore >= 60 ? "red" : s.riskScore >= 30 ? "amber" : "green"}>{s.riskScore}</Badge></td>
                <td className="px-4 py-2 text-slate-500">{lastAttempt.has(s.patientMrd) ? new Date(lastAttempt.get(s.patientMrd)!).toISOString().slice(0, 10) : "—"}</td>
                <td className="px-4 py-2 text-slate-600">{owners(s.successOwnerId)}</td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <form action={assignSuccessOwner.bind(null, s.patientMrd)} className="flex items-center gap-1">
                        <select name="ownerId" defaultValue={s.successOwnerId ?? ""} className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">unassigned</option>{staff.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>
                        <button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Assign</button>
                      </form>
                      <form action={recordReactivationAttempt.bind(null, s.patientMrd)} className="flex items-center gap-1">
                        <select name="contactMode" required defaultValue="" className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">mode…</option>{RETENTION_CONTACT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                        <select name="outcome" required defaultValue="" className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">outcome…</option>{RETENTION_OUTCOMES.map((o) => <option key={o} value={o}>{RETENTION_OUTCOME_LABELS[o]}</option>)}</select>
                        <button className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50">Log</button>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
