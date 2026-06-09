import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, REACTIVATION_PROGRAMS, REACTIVATION_PROGRAM_LABELS, type ReactivationProgram } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";
import { launchReactivationCampaign } from "@/lib/retention/actions";
import { reactivationCampaigns } from "@/lib/retention/metrics";
import { approvedActivities } from "@/lib/planning/gate";

export const dynamic = "force-dynamic";

export default async function ReactivationCampaigns() {
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");

  const [campaigns, templates, drives] = await Promise.all([
    reactivationCampaigns(),
    prisma.communicationTemplate.findMany({ orderBy: { name: "asc" } }).catch(() => [] as { id: string; name: string }[]),
    approvedActivities("retention", "reactivation_drive"),
  ]);

  return (
    <div>
      <PageHeader
        title="Reactivation campaigns"
        subtitle="Typed programs to bring dormant patients back (Module 12)"
        action={<div className="flex items-center gap-2"><LinkButton href="/retention/worklist" tone="ghost">Worklist</LinkButton><LinkButton href="/retention" tone="ghost">← Retention</LinkButton></div>}
      />

      <div className={`mb-6 rounded-xl border px-4 py-2 text-sm ${drives.length ? "border-rose-100 bg-rose-50/60 text-slate-600" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
        {drives.length
          ? <>Campaigns run under the approved drive: <span className="font-medium">{drives.map((d) => d.label).join(", ")}</span>.</>
          : <>No approved reactivation drive — <Link href="/modules/retention/plan" className="font-medium underline">plan &amp; approve one first →</Link> (campaigns are gated on it).</>}
      </div>

      {canEdit && (
        <Card>
          <form action={launchReactivationCampaign} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col text-sm">Campaign name
              <input name="name" placeholder="e.g. Monsoon Panchakarma drive" className="rounded border border-slate-300 px-2 py-1" />
            </label>
            <label className="flex flex-col text-sm">Program
              <select name="program" defaultValue="annual_wellness" className="rounded border border-slate-300 px-2 py-1">{REACTIVATION_PROGRAMS.map((p) => <option key={p} value={p}>{REACTIVATION_PROGRAM_LABELS[p as ReactivationProgram]}</option>)}</select>
            </label>
            <label className="flex flex-col text-sm">Segment
              <select name="segment" defaultValue="dormant" className="rounded border border-slate-300 px-2 py-1"><option value="at_risk">At-risk</option><option value="dormant">Dormant</option><option value="lost">Lost</option></select>
            </label>
            <label className="flex flex-col text-sm">Channel
              <select name="channel" defaultValue="whatsapp" className="rounded border border-slate-300 px-2 py-1"><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option></select>
            </label>
            <label className="flex flex-col text-sm">Template
              <select name="templateId" defaultValue="" className="rounded border border-slate-300 px-2 py-1"><option value="">(no template)</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <div className="flex items-end"><SubmitButton>Launch campaign</SubmitButton></div>
          </form>
        </Card>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Campaigns &amp; response funnel</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Campaign</th><th className="px-4 py-2">Program</th><th className="px-4 py-2">Channel</th><th className="px-4 py-2">Launched</th><th className="px-4 py-2 text-right">Sent</th><th className="px-4 py-2 text-right">Contacted</th><th className="px-4 py-2 text-right">Booked</th></tr></thead>
          <tbody>
            {campaigns.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-slate-400">No reactivation campaigns yet. Launch one above.</td></tr>}
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2"><Badge tone="blue">{(REACTIVATION_PROGRAM_LABELS as Record<string, string>)[c.program ?? ""] ?? c.program ?? "—"}</Badge></td>
                <td className="px-4 py-2 text-slate-500">{c.channel}</td>
                <td className="px-4 py-2 text-slate-400">{c.launchedAt ? new Date(c.launchedAt).toISOString().slice(0, 10) : "—"}</td>
                <td className="px-4 py-2 text-right">{c.sent}</td>
                <td className="px-4 py-2 text-right text-blue-600">{c.contacted}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{c.booked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
