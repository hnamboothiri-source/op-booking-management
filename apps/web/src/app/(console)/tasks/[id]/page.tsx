import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionTask } from "@/lib/tasks/actions";
import { canTransition, can, TASK_OUTCOMES, type TaskStatus } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = { open: "slate", in_progress: "blue", completed: "green", overdue: "red", cancelled: "slate", escalated: "amber" };
const NEXT: TaskStatus[] = ["in_progress", "completed", "escalated", "cancelled"];

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("tasks", "view");
  const t = await prisma.task.findUnique({ where: { id }, include: { assignee: true, lead: true } });
  if (!t) notFound();
  const canEdit = can(user.role, "tasks", "edit");

  return (
    <div>
      <PageHeader title={t.subject} subtitle={t.type.replace(/_/g, " ")} action={<Badge tone={TONE[t.status]}>{t.status.replace(/_/g, " ")}</Badge>} />
      <div className="mb-6"><Link href="/tasks" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Tasks</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Assignee</div><div className="font-medium">{t.assignee?.name ?? "Unassigned"}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Due</div><div className="font-medium">{t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "—"}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Priority</div><div className="font-medium">{t.priority}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Related</div><div className="font-medium">{t.lead ? <Link href={`/leads/${t.leadId}`} className="text-rose-700 hover:underline dark:text-rose-300">{t.lead.contactName}</Link> : t.patientMrd ? <Link href={`/patients/${encodeURIComponent(t.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{t.patientMrd}</Link> : "—"}</div></Card>
      </div>

      {t.outcome && (
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Outcome</div>
          <div className="mt-1 text-sm"><span className="font-medium capitalize">{t.outcome.replace(/_/g, " ")}</span>{t.remarks ? ` — ${t.remarks}` : ""}</div>
        </Card>
      )}

      {canEdit && (() => {
        const next = NEXT.filter((s) => canTransition(t.status as TaskStatus, s));
        const simple = next.filter((s) => s !== "completed" && s !== "escalated");
        const closing = next.filter((s) => s === "completed" || s === "escalated");
        const input = "rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800";
        return (
          <div className="mt-6 space-y-4">
            {simple.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {simple.map((s) => (
                  <form key={s} action={transitionTask.bind(null, t.id, s)}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{s.replace(/_/g, " ")}</button></form>
                ))}
              </div>
            )}
            {closing.map((s) => (
              <Card key={s}>
                <h2 className="mb-2 font-semibold capitalize">{s.replace(/_/g, " ")} task</h2>
                <form action={transitionTask.bind(null, t.id, s)} className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Outcome<select name="outcome" required defaultValue="" className={`${input} mt-1 block`}><option value="">— select —</option>{TASK_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select></label>
                  <label className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-300">Outcome note<input name="remarks" required placeholder="What happened / next step" className={`${input} mt-1 block w-full`} /></label>
                  <SubmitButton tone={s === "escalated" ? "danger" : "primary"}>{s.replace(/_/g, " ")}</SubmitButton>
                </form>
              </Card>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
