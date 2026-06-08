import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createSchedule, generateSlots } from "@/lib/appointments/actions";
import { PageHeader, SubmitButton, Card, Badge, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Schedules({ searchParams }: { searchParams: Promise<{ date?: string; generated?: string }> }) {
  await requireCan("appointments", "view");
  const { date, generated } = await searchParams;

  const [schedules, doctors, departments, branches, slots] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { active: true }, include: { doctor: true, department: true }, orderBy: { dayOfWeek: "asc" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    date ? prisma.timeSlot.findMany({ where: { slotDate: new Date(date) }, include: { doctor: true, department: true }, orderBy: [{ doctor: { name: "asc" } }, { startTime: "asc" }] }) : [],
  ]);

  return (
    <div>
      <PageHeader title="Doctor schedules & slots" subtitle="Templates generate bookable slots" action={<LinkButton href="/appointments" tone="ghost">← Worklist</LinkButton>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">New schedule template</h2>
          <form action={createSchedule} className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">Doctor<select name="doctorId" required className={input}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Department<select name="departmentId" required className={input}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Branch<select name="branchId" className={input}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Day of week<select name="dayOfWeek" className={input}><option value="">—</option>{DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Start<input type="time" name="startTime" defaultValue="09:00" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">End<input type="time" name="endTime" defaultValue="12:00" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Slot mins<input type="number" name="slotDurationMinutes" defaultValue="20" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Max / slot<input type="number" name="maxPatientsPerSlot" defaultValue="1" className={input} /></label>
            <div className="col-span-2"><SubmitButton>Add template</SubmitButton></div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Generate slots for a date</h2>
          <form action={generateSlots} className="flex items-end gap-2">
            <label className="text-xs font-medium text-slate-600">Date<input type="date" name="date" required className={input} /></label>
            <SubmitButton>Generate</SubmitButton>
          </form>
          {generated !== undefined && <p className="mt-2 text-sm text-rose-700">Generated {generated} slot(s) for {date}.</p>}
          <form className="mt-4 flex items-end gap-2" action="/appointments/schedules">
            <label className="text-xs font-medium text-slate-600">View slots on<input type="date" name="date" defaultValue={date ?? ""} className={input} /></label>
            <button className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-medium text-white">View</button>
          </form>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Templates ({schedules.length})</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((s) => (
            <div key={s.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">
              <div className="font-medium">{s.doctor.name} · {s.department.name}</div>
              <div className="text-xs text-slate-500">{s.dayOfWeek !== null ? DOW[s.dayOfWeek] : s.specificDate?.toISOString().slice(0, 10)} · {s.startTime}–{s.endTime} · {s.slotDurationMinutes}m · cap {s.maxPatientsPerSlot}</div>
            </div>
          ))}
          {schedules.length === 0 && <p className="text-sm text-slate-400">No templates yet.</p>}
        </div>
      </div>

      {date && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Slots on {date} ({slots.length})</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Doctor</th><th className="px-4 py-2">Dept</th><th className="px-4 py-2">Time</th><th className="px-4 py-2">Booked</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr></thead>
              <tbody>
                {slots.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No slots. Generate above.</td></tr>}
                {slots.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{s.doctor.name}</td>
                    <td className="px-4 py-2 text-slate-600">{s.department.name}</td>
                    <td className="px-4 py-2">{s.startTime}–{s.endTime}</td>
                    <td className="px-4 py-2 text-slate-600">{s.bookedCount}/{s.capacity}</td>
                    <td className="px-4 py-2"><Badge tone={s.status === "open" ? "green" : "slate"}>{s.status}</Badge></td>
                    <td className="px-4 py-2 text-right">{s.status === "open" && <LinkButton href={`/appointments/book?slotId=${s.id}`} tone="ghost">Book</LinkButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
