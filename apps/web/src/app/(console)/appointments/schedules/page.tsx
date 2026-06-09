import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createSchedule, createDoctorLeave } from "@/lib/appointments/actions";
import { weekOfMonthLabel } from "@prm/core";
import { PageHeader, SubmitButton, Card, Badge, LinkButton } from "@/components/ui";
import { PlanActivitySelect } from "@/components/planning/PlanActivitySelect";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Schedules() {
  await requireCan("appointments", "view");

  const [schedules, doctors, departments, branches, leaves, rooms] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { active: true }, include: { doctor: true, department: true }, orderBy: { dayOfWeek: "asc" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.doctorLeave.findMany({ include: { doctor: true }, orderBy: { fromDate: "desc" }, take: 20 }),
    prisma.consultationRoom.findMany({ where: { active: true } }),
  ]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const docName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? "—";
  schedules.sort((a, b) => (a.doctor.name).localeCompare(b.doctor.name) || (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0));

  return (
    <div>
      <PageHeader title="Doctor schedule templates" subtitle="Master weekly schedule — bookable slots derive automatically (no daily generation)" action={<LinkButton href="/appointments/grid" tone="ghost">Room × Day grid →</LinkButton>} />

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
            <div className="col-span-2"><PlanActivitySelect slug="appointments" typeKey="doctor_schedule" /></div>
            <div className="col-span-2"><SubmitButton>Add template</SubmitButton></div>
          </form>
          <p className="mt-2 text-xs text-slate-400">For day-to-day room/slot edits use the <LinkButton href="/appointments/grid" tone="ghost">Room × Day grid</LinkButton> (no approval needed).</p>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Doctor leave / emergency block</h2>
          <form action={createDoctorLeave} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">Doctor<select name="doctorId" required className={input}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">From<input type="date" name="fromDate" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">To<input type="date" name="toDate" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Kind<select name="kind" className={input}><option value="leave">leave</option><option value="emergency_block">emergency block</option></select></label>
            <label className="text-xs font-medium text-slate-600">Covered by (substitute)<select name="coverDoctorId" className={input}><option value="">— slot dropped —</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <div className="flex items-end"><SubmitButton tone="ghost">Block</SubmitButton></div>
          </form>
          <p className="mt-2 text-xs text-slate-400">A substitute takes the on-leave doctor's slots for those dates; leave it blank to drop the slots.</p>
          {leaves.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {leaves.map((l) => (
                <span key={l.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {l.doctor.name} · {l.fromDate.toISOString().slice(0, 10)}{l.toDate && l.toDate.toISOString().slice(0, 10) !== l.fromDate.toISOString().slice(0, 10) ? `–${l.toDate.toISOString().slice(0, 10)}` : ""} · {l.kind.replace(/_/g, " ")}{l.coverDoctorId ? ` · cover: ${docName(l.coverDoctorId)}` : ""}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Templates ({schedules.length})</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((s) => {
            const room = roomName.get(s.roomId ?? "");
            const wk = weekOfMonthLabel(s.weekOfMonth);
            return (
              <div key={s.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="font-medium">{s.doctor.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{s.dayOfWeek !== null ? DOW[s.dayOfWeek] : s.specificDate?.toISOString().slice(0, 10)}</span>
                  {wk && <Badge tone="amber">{wk}</Badge>}
                  {s.session && s.session !== "full" && <Badge tone="blue">{s.session}</Badge>}
                  <span>{s.startTime}–{s.endTime}</span>
                  {s.slotsCount ? <span>· {s.slotsCount} nos</span> : null}
                  {room && <span>· {room}</span>}
                </div>
              </div>
            );
          })}
          {schedules.length === 0 && <p className="text-sm text-slate-400">No templates yet.</p>}
        </div>
      </div>
    </div>
  );
}
