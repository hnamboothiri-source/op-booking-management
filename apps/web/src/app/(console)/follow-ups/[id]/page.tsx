import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionFollowUp } from "@/lib/followups/actions";
import { can, checklistCompletion, safeParseChecklist } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FollowUpDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("follow_ups", "view");
  const f = await prisma.followUp.findUnique({ where: { id }, include: { patient: true, doctor: true } });
  if (!f) notFound();
  const canEdit = can(user.role, "follow_ups", "edit");
  const canCall = can(user.role, "calls", "create");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (await prisma.callLog.findMany({ where: { followUpId: id } as any, orderBy: { createdAt: "desc" } }).catch(() => [])) as { id: string; outcome: string; notes: string | null; checklistJson?: string | null; createdAt: Date }[];

  return (
    <div>
      <PageHeader title="Follow-up" subtitle={`${f.patient?.name ?? f.patientMrd} · ${f.type.replace(/_/g, " ")}`} action={<Badge tone={f.status === "done" ? "green" : f.status === "missed" ? "red" : "blue"}>{f.status}</Badge>} />
      <div className="mb-6"><Link href="/follow-ups" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Follow-ups</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Patient</div><div className="font-medium"><Link href={`/patients/${encodeURIComponent(f.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{f.patient?.name ?? f.patientMrd}</Link></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Type</div><div className="font-medium">{f.type.replace(/_/g, " ")}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Due</div><div className="font-medium">{f.dueDate.toISOString().slice(0, 10)}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Doctor</div><div className="font-medium">{f.doctor?.name ?? "—"}</div></Card>
      </div>

      {canEdit && f.status !== "done" && (
        <div className="flex flex-wrap items-center gap-2">
          {canCall && <LinkButton href={`/follow-ups/${f.id}/call`}>Open review call ☑</LinkButton>}
          <LinkButton href={`/appointments/book?mrd=${encodeURIComponent(f.patientMrd)}`} tone="ghost">Book appointment</LinkButton>
          <form action={transitionFollowUp.bind(null, f.id, "done")}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark done</button></form>
          <form action={transitionFollowUp.bind(null, f.id, "missed")}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark missed</button></form>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Calls &amp; checklist</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-slate-400">No review calls logged yet.</p>
        ) : (
          <div className="space-y-2">
            {calls.map((c) => {
              const cl = checklistCompletion(safeParseChecklist(c.checklistJson));
              const answered = safeParseChecklist(c.checklistJson);
              return (
                <Card key={c.id}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium capitalize">{c.outcome.replace(/_/g, " ")}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {cl.total > 0 && <Badge tone={cl.done === cl.total ? "green" : "amber"}>checklist {cl.done}/{cl.total}</Badge>}
                      <span>{new Date(c.createdAt).toISOString().slice(0, 10)}</span>
                    </div>
                  </div>
                  {c.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{c.notes}</p>}
                  {answered.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {answered.map((a, i) => (
                        <li key={i}>{a.checked || (a.value && a.value.trim()) ? "✓" : "○"} {a.label}{a.value ? `: ${a.value}` : ""}{a.note ? ` — ${a.note}` : ""}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
