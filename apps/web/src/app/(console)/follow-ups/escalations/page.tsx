import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { escalationTier } from "@prm/core";
import { runFollowUpEscalation } from "@/lib/followups/actions";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const startOfToday = () => new Date(new Date().toISOString().slice(0, 10));
const daysOverdue = (d: Date) => Math.floor((startOfToday().getTime() - new Date(new Date(d).toISOString().slice(0, 10)).getTime()) / 86400000);

export default async function EscalationDashboard() {
  await requireCan("follow_ups", "view");
  const today = startOfToday();

  const [openOverdue, escalations, staff, admissionPending, medicinePending] = await Promise.all([
    prisma.followUp.findMany({ where: { status: { in: ["pending", "booked", "overdue"] }, dueDate: { lt: today } }, include: { patient: true } }),
    prisma.followUpEscalation.findMany({ where: { status: "open" }, orderBy: [{ level: "desc" }, { createdAt: "desc" }] }).catch(() => [] as Record<string, unknown>[]),
    prisma.staffUser.findMany({ where: { active: true } }),
    prisma.followUp.count({ where: { type: "admission", status: { in: ["pending", "booked", "overdue"] } } }),
    prisma.followUp.count({ where: { type: "medicine", status: { in: ["pending", "booked", "overdue"] } } }),
  ]);
  const ownerName = (id: string | null | undefined) => staff.find((s) => s.id === id)?.name ?? "Unassigned";

  // Overdue grouped by executive (owner).
  const byOwner = new Map<string, number>();
  for (const f of openOverdue) byOwner.set(f.ownerId ?? "", (byOwner.get(f.ownerId ?? "") ?? 0) + 1);
  const ownerRows = [...byOwner.entries()].sort((a, b) => b[1] - a[1]);

  const stat = (label: string, value: React.ReactNode, tone?: string) => (
    <Card><div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div><div className="text-xs text-slate-500 dark:text-slate-400">{label}</div></Card>
  );

  return (
    <div>
      <PageHeader
        title="Follow-up escalations"
        subtitle="SLA breaches by tier — manager view"
        action={<form action={runFollowUpEscalation}><SubmitButton>Run escalation</SubmitButton></form>}
      />
      <div className="mb-4"><Link href="/follow-ups" className="text-sm text-slate-500 hover:underline">← Follow-ups</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Open overdue", openOverdue.length, "text-amber-600")}
        {stat("Open escalations", escalations.length, "text-red-600")}
        {stat("Admission pending", admissionPending)}
        {stat("Medicine pending", medicinePending)}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Overdue by executive</div>
          <table className="w-full text-sm">
            <tbody>
              {ownerRows.length === 0 && <tr><td className="px-4 py-3 text-slate-400">No overdue follow-ups.</td></tr>}
              {ownerRows.map(([id, n]) => (
                <tr key={id || "none"} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2">{ownerName(id)}</td>
                  <td className="px-4 py-2 text-right font-medium">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Open escalations by tier</div>
          <table className="w-full text-sm">
            <tbody>
              {escalations.length === 0 && <tr><td className="px-4 py-3 text-slate-400">None. Click &ldquo;Run escalation&rdquo; to process overdue follow-ups.</td></tr>}
              {escalations.map((e) => (
                <tr key={e.id as string} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2"><Badge tone={(e.level as number) >= 3 ? "red" : "amber"}>L{e.level as number}</Badge></td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{(e.reason as string) ?? ""}</td>
                  <td className="px-4 py-2 text-right"><Link href={`/follow-ups/${e.followUpId}`} className="text-rose-700 hover:underline dark:text-rose-300">open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Overdue follow-ups</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2 text-right">Days overdue</th><th className="px-4 py-2">Tier</th></tr></thead>
          <tbody>
            {openOverdue.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-slate-400">None.</td></tr>}
            {openOverdue.sort((a, b) => daysOverdue(b.dueDate) - daysOverdue(a.dueDate)).map((f) => {
              const d = daysOverdue(f.dueDate);
              const tier = escalationTier(d);
              return (
                <tr key={f.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-2"><Link href={`/follow-ups/${f.id}`} className="text-rose-700 hover:underline dark:text-rose-300">{f.patient?.name ?? f.patientMrd}</Link></td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{f.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 text-slate-500">{ownerName(f.ownerId)}</td>
                  <td className="px-4 py-2 text-right">{d}</td>
                  <td className="px-4 py-2"><Badge tone={tier.level >= 3 ? "red" : tier.level >= 1 ? "amber" : "slate"}>L{tier.level} · {tier.notify.replace(/_/g, " ")}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
