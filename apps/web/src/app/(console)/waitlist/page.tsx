import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addToWaitlist, promoteWaitlist, cancelWaitlist } from "@/lib/waitlist/actions";
import { sortWaitlist, can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function Waitlist() {
  const user = await requireCan("appointments", "view");
  const canEdit = can(user.role, "appointments", "edit");

  const [waiting, departments, doctors] = await Promise.all([
    prisma.waitlistEntry.findMany({ where: { status: "waiting" }, include: { patient: true, doctor: true } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const ordered = sortWaitlist(waiting);
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Waitlist" subtitle="Promote in priority then FIFO order (Module 3)" />

      {can(user.role, "appointments", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">Add to waitlist</h2>
          <form action={addToWaitlist} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <input name="patientMrd" placeholder="Patient MRD" required className={input} />
            <select name="departmentId" required className={input}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select name="doctorId" className={input}><option value="">Any doctor</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <input type="date" name="requestedDate" required className={input} />
            <div className="flex gap-2">
              <input type="number" name="priority" defaultValue="0" title="Higher = sooner" className={`${input} w-16`} />
              <SubmitButton>Add</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Department</th><th className="px-4 py-2">Doctor</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Priority</th>{canEdit && <th className="px-4 py-2">Actions</th>}</tr></thead>
          <tbody>
            {ordered.length === 0 && <tr><td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-slate-400">No one waiting.</td></tr>}
            {ordered.map((w, i) => (
              <tr key={w.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(w.patientMrd)}`} className="font-medium text-emerald-700 hover:underline">{w.patient.name}</Link></td>
                <td className="px-4 py-2 text-slate-600">{deptName(w.departmentId)}</td>
                <td className="px-4 py-2 text-slate-600">{w.doctor?.name ?? "Any"}</td>
                <td className="px-4 py-2 text-slate-600">{w.requestedDate.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2">{w.priority > 0 ? <Badge tone="amber">{w.priority}</Badge> : w.priority}</td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <form action={promoteWaitlist.bind(null, w.id)} className="flex items-center gap-1">
                        {!w.doctorId && <select name="doctorId" required className="rounded border border-slate-300 px-1 py-0.5 text-xs">{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
                        <input name="startTime" type="time" defaultValue="10:00" className="rounded border border-slate-300 px-1 py-0.5 text-xs" />
                        <button className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700">Promote</button>
                      </form>
                      <form action={cancelWaitlist.bind(null, w.id)}><button className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button></form>
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
