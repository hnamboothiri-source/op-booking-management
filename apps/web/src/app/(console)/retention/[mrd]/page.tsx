import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, formatINR, RETENTION_OUTCOME_LABELS, RETENTION_OUTCOME_TONE, PLV_TIER_TONE, riskBand, retentionBand, RISK_BAND_LABELS, RISK_BAND_TONE, RETENTION_BAND_LABELS, RETENTION_BAND_TONE, type RetentionOutcome } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";
import { recordReactivationAttempt } from "@/lib/retention/actions";
import { computePlv } from "@/lib/retention/metrics";
import { RETENTION_CONTACT_MODES, RETENTION_OUTCOMES } from "@prm/core";

export const dynamic = "force-dynamic";

const catTone: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  active: "green", reactivated: "green", follow_up_pending: "blue", at_risk: "amber", dormant: "amber", lost: "red",
};

export default async function RetentionProfile({ params }: { params: Promise<{ mrd: string }> }) {
  const { mrd: raw } = await params;
  const mrd = decodeURIComponent(raw);
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");

  const patient = await prisma.patient.findUnique({ where: { mrd } });
  if (!patient) notFound();

  const [status, scores, activities, comms, plv, staff] = await Promise.all([
    prisma.retentionStatus.findUnique({ where: { patientMrd: mrd } }).catch(() => null),
    prisma.patientScore.findMany({ where: { patientMrd: mrd }, orderBy: { computedAt: "desc" } }).catch(() => [] as { kind: string; score: number; computedAt: Date }[]),
    prisma.retentionActivity.findMany({ where: { patientMrd: mrd }, orderBy: { contactDate: "desc" }, take: 50 }).catch(() => [] as { id: string; contactMode: string; outcome: string; remarks: string | null; contactDate: Date; actorId: string | null; campaignId: string | null }[]),
    prisma.communicationLog.findMany({ where: { patientMrd: mrd }, orderBy: { sentAt: "desc" }, take: 10 }).catch(() => [] as { id: string; channel: string; status: string; sentAt: Date | null }[]),
    computePlv(mrd),
    prisma.staffUser.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const latest = (kind: string) => scores.find((s) => s.kind === kind)?.score;
  const retentionS = latest("retention");
  const wellnessS = latest("wellness");
  const riskS = status?.riskScore;
  const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? (id ? id : "—");

  const ScoreCard = ({ label, value, tone }: { label: string; value: number | undefined; tone: string }) => (
    <Card>
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tone}`}>{value ?? "—"}</div>
      <div className="text-xs text-slate-400">{value === undefined ? "Not computed yet" : "/ 100"}</div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={patient.name}
        subtitle={`Retention profile · ${mrd}`}
        action={<div className="flex items-center gap-2"><LinkButton href={`/patients/${encodeURIComponent(mrd)}`} tone="ghost">Patient record</LinkButton><LinkButton href="/retention" tone="ghost">← Retention</LinkButton></div>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {status && <Badge tone={catTone[status.category] ?? "slate"}>{status.category.replace(/_/g, " ")}</Badge>}
        <Badge tone={PLV_TIER_TONE[plv.tier]}>PLV {plv.tier}</Badge>
        {patient.lastVisitDate && <span className="text-xs text-slate-500">Last visit {new Date(patient.lastVisitDate).toISOString().slice(0, 10)}</span>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-xs font-semibold uppercase text-slate-500">Retention</div>
          <div className="mt-1 text-3xl font-bold text-emerald-600">{retentionS ?? "—"}</div>
          {retentionS != null && <Badge tone={RETENTION_BAND_TONE[retentionBand(retentionS)]}>{RETENTION_BAND_LABELS[retentionBand(retentionS)]}</Badge>}
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase text-slate-500">Risk</div>
          <div className={`mt-1 text-3xl font-bold ${riskS && riskS >= 60 ? "text-red-600" : riskS && riskS >= 30 ? "text-amber-600" : "text-slate-700"}`}>{riskS ?? "—"}</div>
          {riskS != null && <Badge tone={RISK_BAND_TONE[riskBand(riskS)]}>{RISK_BAND_LABELS[riskBand(riskS)]}</Badge>}
        </Card>
        <ScoreCard label="Wellness" value={wellnessS} tone="text-blue-600" />
        <Card>
          <div className="text-xs font-semibold uppercase text-slate-500">Lifetime value</div>
          <div className="mt-1 text-2xl font-bold">{formatINR(plv.total)}</div>
          <div className="text-xs text-slate-400">{plv.visits} visits · {plv.tenureDays}d tenure</div>
        </Card>
      </div>

      {/* PLV breakdown */}
      <Card>
        <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Lifetime value breakdown</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-sm">
          <div><div className="text-slate-400">Consultation</div><div className="font-semibold">{formatINR(plv.consultation)}</div></div>
          <div><div className="text-slate-400">Medicine</div><div className="font-semibold">{formatINR(plv.medicine)}</div></div>
          <div><div className="text-slate-400">Therapy</div><div className="font-semibold">{formatINR(plv.therapy)}</div></div>
          <div><div className="text-slate-400">Package</div><div className="font-semibold">{formatINR(plv.package)}</div></div>
          <div><div className="text-slate-400">Total</div><div className="font-bold text-rose-700">{formatINR(plv.total)}</div></div>
        </div>
      </Card>

      {canEdit && (
        <Card>
          <form action={recordReactivationAttempt.bind(null, mrd)} className="flex flex-wrap items-end gap-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Log reactivation attempt</div>
            <select name="contactMode" required defaultValue="" className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="">mode…</option>{RETENTION_CONTACT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select name="outcome" required defaultValue="" className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="">outcome…</option>{RETENTION_OUTCOMES.map((o) => <option key={o} value={o}>{RETENTION_OUTCOME_LABELS[o]}</option>)}</select>
            <input name="remarks" placeholder="remarks" className="w-40 rounded border border-slate-300 px-2 py-1 text-sm" />
            <input type="date" name="nextContactDate" className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <SubmitButton>Log attempt</SubmitButton>
          </form>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Reactivation attempts</div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {activities.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No attempts logged yet.</li>}
            {activities.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{new Date(a.contactDate).toISOString().slice(0, 10)} · {a.contactMode}</span>
                  <Badge tone={RETENTION_OUTCOME_TONE[a.outcome as RetentionOutcome] ?? "slate"}>{RETENTION_OUTCOME_LABELS[a.outcome as RetentionOutcome] ?? a.outcome}</Badge>
                </div>
                {a.remarks && <div className="mt-0.5 text-slate-500">{a.remarks}</div>}
                <div className="mt-0.5 text-xs text-slate-400">by {nameOf(a.actorId)}{a.campaignId ? ` · campaign` : ""}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Recent communications</div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {comms.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">No messages sent.</li>}
            {comms.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{c.sentAt ? new Date(c.sentAt).toISOString().slice(0, 10) : "—"} · {c.channel}</span>
                <Badge tone={c.status === "delivered" || c.status === "sent" ? "green" : "slate"}>{c.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
