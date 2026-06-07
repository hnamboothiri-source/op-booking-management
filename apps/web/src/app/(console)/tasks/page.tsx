import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createTask, transitionTask } from "@/lib/tasks/actions";
import { canTransition, effectiveStatus, can, type TaskStatus } from "@prm/core";
import { PageHeader, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  open: "slate", in_progress: "blue", completed: "green", overdue: "red", cancelled: "slate", escalated: "amber",
};

const TASK_TYPES = [
  "call_back_patient", "confirm_appointment", "follow_up_admission", "follow_up_test",
  "follow_up_medicine", "contact_dormant_patient", "camp_follow_up", "doctor_referral_follow_up",
];
const NEXT_STATES: TaskStatus[] = ["in_progress", "completed", "escalated", "cancelled"];

export default async function TasksPage() {
  const user = await requireCan("tasks", "view");
  const canEdit = can(user.role, "tasks", "edit");
  const canCreate = can(user.role, "tasks", "create");

  const [tasks, staff] = await Promise.all([
    prisma.task.findMany({ include: { assignee: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const now = new Date();

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Module 15 — accountability across teams" />

      {canCreate && (
        <form action={createTask} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-5">
          <select name="type" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {TASK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <input name="subject" placeholder="Subject" required className="rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2" />
          <select name="assigneeId" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" name="dueDate" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <SubmitButton>Add</SubmitButton>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Subject</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 font-medium">Status</th>
              {canEdit && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-6 text-center text-slate-400">No tasks yet.</td></tr>
            )}
            {tasks.map((t) => {
              const eff = effectiveStatus(t.status as TaskStatus, t.dueDate, now);
              return (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{t.subject}</td>
                  <td className="px-4 py-2 text-slate-600">{t.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 text-slate-600">{t.assignee?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "—"}</td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONE[eff]}>{eff.replace(/_/g, " ")}</Badge></td>
                  {canEdit && (
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {NEXT_STATES.filter((s) => canTransition(t.status as TaskStatus, s)).map((s) => (
                          <form key={s} action={transitionTask.bind(null, t.id, s)}>
                            <button type="submit" className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">
                              {s.replace(/_/g, " ")}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
