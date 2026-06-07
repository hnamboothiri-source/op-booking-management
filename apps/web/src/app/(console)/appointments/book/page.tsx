import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createBooking, rescheduleBooking } from "@/lib/appointments/actions";
import { PageHeader, SubmitButton, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ slotId?: string; mrd?: string; leadId?: string; rescheduleFrom?: string }> }) {
  await requireCan("appointments", "create");
  const { slotId, mrd, leadId, rescheduleFrom } = await searchParams;

  const [doctors, departments, branches, slot, lead, oldBooking] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    slotId ? prisma.timeSlot.findUnique({ where: { id: slotId }, include: { doctor: true, department: true } }) : null,
    leadId ? prisma.lead.findUnique({ where: { id: leadId } }) : null,
    rescheduleFrom ? prisma.opBooking.findUnique({ where: { id: rescheduleFrom }, include: { patient: true } }) : null,
  ]);

  const formAction = rescheduleFrom ? rescheduleBooking.bind(null, rescheduleFrom) : createBooking;
  const prefillMrd = mrd ?? oldBooking?.patientMrd ?? "";

  return (
    <div>
      <PageHeader title={rescheduleFrom ? "Reschedule appointment" : "Book appointment"} subtitle={rescheduleFrom ? `Supersedes ${oldBooking?.bookingRef ?? ""}` : slot ? "From an open slot" : "Walk-in / manual"} />
      <div className="mb-4"><Link href="/appointments" className="text-sm text-slate-500 hover:underline">← Appointments</Link></div>

      {lead && <Card><p className="text-sm">Converting lead <strong>{lead.contactName}</strong> ({lead.phone}). Enter the patient MRD (create the patient first if new).</p></Card>}
      {oldBooking && <Card><p className="text-sm">Rescheduling <strong>{oldBooking.patient.name}</strong> from {oldBooking.appointmentDate.toISOString().slice(0, 10)} {oldBooking.startTime}. The original booking will be marked <em>rescheduled</em>.</p></Card>}

      <form action={formAction} className="mt-4 grid max-w-2xl grid-cols-2 gap-4">
        {leadId && <input type="hidden" name="leadId" value={leadId} />}

        <label className="col-span-2 text-sm font-medium text-slate-700">
          Patient MRD *
          <input name="patientMrd" required defaultValue={prefillMrd} placeholder="MRD-xxxxxxxx" className={input} />
          <span className="text-xs font-normal text-slate-400">Find or create under <Link href="/patients" className="underline">Patients</Link>.</span>
        </label>

        {slot ? (
          <>
            <input type="hidden" name="timeSlotId" value={slot.id} />
            <input type="hidden" name="doctorId" value={slot.doctorId} />
            <input type="hidden" name="departmentId" value={slot.departmentId} />
            {slot.branchId && <input type="hidden" name="branchId" value={slot.branchId} />}
            <input type="hidden" name="appointmentDate" value={slot.slotDate.toISOString().slice(0, 10)} />
            <input type="hidden" name="startTime" value={slot.startTime} />
            <input type="hidden" name="endTime" value={slot.endTime} />
            <Card><div className="text-xs text-slate-500">Doctor</div><div className="font-medium">{slot.doctor.name}</div></Card>
            <Card><div className="text-xs text-slate-500">Department</div><div className="font-medium">{slot.department.name}</div></Card>
            <Card><div className="text-xs text-slate-500">Date</div><div className="font-medium">{slot.slotDate.toISOString().slice(0, 10)}</div></Card>
            <Card><div className="text-xs text-slate-500">Time</div><div className="font-medium">{slot.startTime}–{slot.endTime}</div></Card>
          </>
        ) : (
          <>
            <label className="text-sm font-medium text-slate-700">Doctor *
              <select name="doctorId" required className={input}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </label>
            <label className="text-sm font-medium text-slate-700">Department *
              <select name="departmentId" required className={input}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </label>
            <label className="text-sm font-medium text-slate-700">Branch
              <select name="branchId" className={input}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </label>
            <label className="text-sm font-medium text-slate-700">Date *<input type="date" name="appointmentDate" required className={input} /></label>
            <label className="text-sm font-medium text-slate-700">Start time *<input type="time" name="startTime" required className={input} /></label>
          </>
        )}

        <label className="text-sm font-medium text-slate-700">Source
          <select name="source" className={input} defaultValue="call_centre">
            <option value="call_centre">call centre</option>
            <option value="front_desk">front desk (walk-in)</option>
            <option value="follow_up">follow-up</option>
          </select>
        </label>

        <div className="col-span-2"><SubmitButton>Confirm booking</SubmitButton></div>
      </form>
    </div>
  );
}
