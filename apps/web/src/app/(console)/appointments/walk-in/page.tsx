import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { walkInRegister } from "@/lib/appointments/actions";
import { PageHeader, SubmitButton, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export default async function WalkInPage() {
  await requireCan("appointments", "create");
  const [doctors, departments, branches, rooms] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.consultationRoom.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Walk-in registration" subtitle="Register a walk-in patient and check them straight into the queue (Module 3)" />
      <div className="mb-4"><Link href="/appointments" className="text-sm text-slate-500 hover:underline">← Appointments</Link></div>

      <Card><p className="text-sm text-slate-600">Leave MRD blank for a brand-new patient — we&apos;ll create a record and a same-day booking marked <em>arrived</em>.</p></Card>

      <form action={walkInRegister} className="mt-4 grid max-w-2xl grid-cols-2 gap-4">
        <label className="col-span-2 text-sm font-medium text-slate-700">Existing MRD (optional)<input name="patientMrd" placeholder="MRD-xxxxxxxx" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">New patient name<input name="name" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Phone<input name="phone" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Place<input name="place" className={input} /></label>
        <div />
        <label className="text-sm font-medium text-slate-700">Doctor *<select name="doctorId" required className={input}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Department *<select name="departmentId" required className={input}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Branch<select name="branchId" className={input}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Room<select name="roomId" className={input}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Time<input type="time" name="startTime" className={input} /></label>
        <div className="col-span-2"><SubmitButton>Register & check in</SubmitButton></div>
      </form>
    </div>
  );
}
