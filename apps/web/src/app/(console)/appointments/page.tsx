import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionBooking } from "@/lib/appointments/actions";
import { nextBookingStatuses, branchScopeWhere, can, type BookingStatus } from "@prm/core";
import { PageHeader, LinkButton, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  booked: "slate", confirmed: "blue", arrived: "amber", waiting: "amber",
  in_consultation: "blue", completed: "green", cancelled: "slate", no_show: "red", rescheduled: "slate",
};

export default async function Appointments({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireCan("appointments", "view");
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);
  const canEdit = can(user.role, "appointments", "edit");

  const bookings = await prisma.opBooking.findMany({
    where: { appointmentDate: new Date(day), ...branchScopeWhere(user.role, user.branchId) },
    include: { patient: true, doctor: true, department: true, room: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle={`${bookings.length} on ${day}`}
        action={<div className="flex gap-2"><LinkButton href="/appointments/schedules" tone="ghost">Schedules</LinkButton><LinkButton href="/appointments/walk-in" tone="ghost">Walk-in</LinkButton><LinkButton href="/appointments/book">+ Book</LinkButton></div>}
      />
      <form className="mb-4 flex items-center gap-2 text-sm" action="/appointments">
        <label className="text-slate-500">Date</label>
        <input type="date" name="date" defaultValue={day} className="rounded-md border border-slate-300 px-2 py-1.5" />
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Go</button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th><th className="px-4 py-2 font-medium">Patient</th>
              <th className="px-4 py-2 font-medium">Doctor</th><th className="px-4 py-2 font-medium">Dept</th>
              <th className="px-4 py-2 font-medium">Room</th><th className="px-4 py-2 font-medium">Ref</th><th className="px-4 py-2 font-medium">Status</th>
              {canEdit && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && <tr><td colSpan={canEdit ? 8 : 7} className="px-4 py-6 text-center text-slate-400">No appointments. Generate slots & book.</td></tr>}
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{b.startTime}</td>
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(b.patientMrd)}`} className="text-emerald-700 hover:underline">{b.patient.name}</Link></td>
                <td className="px-4 py-2 text-slate-600">{b.doctor.name}</td>
                <td className="px-4 py-2 text-slate-600">{b.department.name}</td>
                <td className="px-4 py-2 text-slate-600">{b.room?.name ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{b.bookingRef}</td>
                <td className="px-4 py-2"><Badge tone={TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge></td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {["arrived", "waiting", "in_consultation"].includes(b.status) && (
                        <Link href={`/consultations/${b.id}`} className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700">Consult</Link>
                      )}
                      {["booked", "confirmed"].includes(b.status) && (
                        <Link href={`/appointments/book?rescheduleFrom=${b.id}`} className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">Reschedule</Link>
                      )}
                      {nextBookingStatuses(b.status as BookingStatus).map((s) => (
                        <form key={s} action={transitionBooking.bind(null, b.id, s)}>
                          <button className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">{s.replace(/_/g, " ")}</button>
                        </form>
                      ))}
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
