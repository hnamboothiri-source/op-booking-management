import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionBooking, cancelBooking } from "@/lib/appointments/actions";
import { nextBookingStatuses, can, type BookingStatus } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  booked: "slate", confirmed: "blue", arrived: "amber", waiting: "amber",
  in_consultation: "blue", completed: "green", cancelled: "slate", no_show: "red", rescheduled: "slate",
};

export default async function AppointmentDetail({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const user = await requireCan("appointments", "view");
  const b = await prisma.opBooking.findUnique({ where: { id: bookingId }, include: { patient: true, doctor: true, department: true, room: true, consultation: true, rescheduledFrom: true, rescheduledTo: true } });
  if (!b) notFound();
  const canEdit = can(user.role, "appointments", "edit");
  const [history, cancelReasons] = await Promise.all([
    prisma.appointmentStatusHistory.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } }),
    prisma.reasonMaster.findMany({ where: { category: "cancellation", active: true } }),
  ]);
  const input = "rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const rescheduledTo = b.rescheduledTo ?? [];

  return (
    <div>
      <PageHeader
        title={`Appointment · ${b.bookingRef}`}
        subtitle={`${b.patient.name} · ${b.appointmentDate.toISOString().slice(0, 10)} ${b.startTime}`}
        action={<Badge tone={TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge>}
      />
      <div className="mb-6"><Link href="/appointments" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Appointments</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Patient</div><div className="font-medium"><Link href={`/patients/${encodeURIComponent(b.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{b.patient.name}</Link></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Doctor</div><div className="font-medium">{b.doctor.name}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Department</div><div className="font-medium">{b.department.name}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Type · Room</div><div className="font-medium capitalize">{(b.appointmentType ?? "regular").replace(/_/g, " ")}{b.room ? ` · ${b.room.name}` : ""}</div></Card>
      </div>

      {(b.cancellationReason || b.rescheduleReason || b.rescheduledFrom || rescheduledTo.length > 0) && (
        <div className="mb-4 space-y-1 text-sm">
          {b.cancellationReason && <div className="text-red-700 dark:text-red-300">Cancelled — {b.cancellationReason}</div>}
          {b.rescheduleReason && <div className="text-amber-700 dark:text-amber-300">Rescheduled — {b.rescheduleReason}</div>}
          {b.rescheduledFrom && <div className="text-slate-500">↳ rescheduled from <Link href={`/appointments/${b.rescheduledFrom.id}`} className="text-rose-700 hover:underline dark:text-rose-300">{b.rescheduledFrom.bookingRef}</Link></div>}
          {rescheduledTo.map((r) => <div key={r.id} className="text-slate-500">↳ rescheduled to <Link href={`/appointments/${r.id}`} className="text-rose-700 hover:underline dark:text-rose-300">{r.bookingRef}</Link></div>)}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {["arrived", "waiting", "in_consultation"].includes(b.status) && <LinkButton href={`/consultations/${b.id}`}>Start consultation</LinkButton>}
        {["booked", "confirmed"].includes(b.status) && <LinkButton href={`/appointments/book?rescheduleFrom=${b.id}`} tone="ghost">Reschedule</LinkButton>}
        {b.consultation && <LinkButton href={`/consultations/${b.id}`} tone="ghost">View consultation</LinkButton>}
        {canEdit && nextBookingStatuses(b.status as BookingStatus).filter((s) => s !== "cancelled").map((s) => (
          <form key={s} action={transitionBooking.bind(null, b.id, s)}>
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{s.replace(/_/g, " ")}</button>
          </form>
        ))}
        {canEdit && nextBookingStatuses(b.status as BookingStatus).includes("cancelled") && (
          <form action={cancelBooking.bind(null, b.id)} className="flex items-center gap-1">
            <select name="cancellationReasonId" required className={input}><option value="">cancel…</option>{cancelReasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
            <SubmitButton tone="ghost">Cancel</SubmitButton>
          </form>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status history ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No status changes recorded.</p>
        ) : (
          <ol className="relative space-y-2 border-l border-slate-200 pl-5 dark:border-slate-700">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden />
                <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-slate-700 dark:text-slate-200">{h.fromStatus ? `${h.fromStatus.replace(/_/g, " ")} → ` : ""}<span className="font-medium">{h.toStatus.replace(/_/g, " ")}</span>{h.reason ? ` · ${h.reason}` : ""}</span>
                  <div className="mt-0.5 text-xs text-slate-400">{h.createdAt.toISOString().slice(0, 16).replace("T", " ")}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
