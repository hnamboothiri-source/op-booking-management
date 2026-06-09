import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, weekOfMonthLabel } from "@prm/core";
import { saveScheduleSlot, deleteSchedule } from "@/lib/appointments/actions";
import { PageHeader, Card, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function ScheduleGrid() {
  const user = await requireCan("appointments", "view");
  const canEdit = can(user.role, "appointments", "edit");
  const [rooms, schedules, doctors, departments] = await Promise.all([
    prisma.consultationRoom.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.doctorSchedule.findMany({ where: { active: true }, include: { doctor: true } }),
    prisma.doctor.findMany({ where: { active: true, opDoctor: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const shortName = (n: string) => n.replace(/^Dr\.?\s*/i, "Dr ").split(" ").slice(0, 2).join(" ");
  // index schedules by roomId|dayOfWeek
  const cell = (roomId: string | null, dow: number) => schedules.filter((s) => (s.roomId ?? "none") === (roomId ?? "none") && s.dayOfWeek === dow);
  const roomRows = [...rooms, { id: "none", name: "Unassigned room", code: null } as { id: string; name: string; code: string | null }];

  return (
    <div>
      <PageHeader title="Weekly Room × Day allotment" subtitle="Doctor room-slot grid — edit anytime (operational; no plan approval needed)" />
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/appointments/schedules" className="text-rose-700 hover:underline">Templates & leave →</Link>
        <Link href="/appointments/board" className="text-rose-700 hover:underline">Booking board →</Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left uppercase text-slate-500">
            <tr><th className="px-2 py-2">Room</th>{DOW.map((d) => <th key={d} className="px-2 py-2">{d}</th>)}</tr>
          </thead>
          <tbody>
            {roomRows.map((room) => (
              <tr key={room.id} className="border-t border-slate-100 align-top">
                <td className="px-2 py-2 font-medium text-slate-700">{room.code ?? room.name}</td>
                {DOW.map((_, dow) => (
                  <td key={dow} className="px-2 py-2">
                    <div className="space-y-1">
                      {cell(room.id === "none" ? null : room.id, dow).map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-1 rounded border border-slate-100 bg-slate-50 px-1.5 py-1">
                          <span>
                            <span className="font-medium">{shortName(s.doctor.name)}</span>
                            <span className="ml-1 text-slate-400">{s.session === "a" ? "PM" : s.session === "m" ? "AM" : ""}{s.slotsCount ? ` ·${s.slotsCount}` : ""}{s.weekOfMonth ? ` ·${weekOfMonthLabel(s.weekOfMonth)}` : ""}</span>
                          </span>
                          {canEdit && <form action={deleteSchedule.bind(null, s.id)}><button className="text-slate-300 hover:text-red-600">✕</button></form>}
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <Card>
          <h2 className="mb-3 font-semibold">Add / update a slot</h2>
          <form action={saveScheduleSlot} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Doctor<select name="doctorId" required className={input}>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Department<select name="departmentId" required className={input}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Room<select name="roomId" className={input}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.code ?? r.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Day<select name="dayOfWeek" required className={input}>{DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Session<select name="session" className={input}><option value="full">Full</option><option value="m">Morning</option><option value="a">Afternoon</option></select></label>
            <label className="text-xs font-medium text-slate-600">Slots (nos)<input type="number" name="slotsCount" defaultValue="2" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Start<input type="time" name="startTime" defaultValue="09:30" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">End<input type="time" name="endTime" defaultValue="13:00" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Week of month<input name="weekOfMonth" placeholder="e.g. 1,3 (blank=every)" className={input} /></label>
            <div className="sm:col-span-4"><SubmitButton>Save slot</SubmitButton></div>
          </form>
          <p className="mt-2 text-xs text-slate-400">Editable anytime — the booking board &amp; bookings derive from this master schedule automatically (no slot generation).</p>
        </Card>
      )}
    </div>
  );
}
