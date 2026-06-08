import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionBooking } from "@/lib/appointments/actions";
import { nextBookingStatuses, can, type BookingStatus } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  booked: "slate", confirmed: "blue", arrived: "amber", waiting: "amber",
  in_consultation: "blue", completed: "green", cancelled: "slate", no_show: "red", rescheduled: "slate",
};

export default async function AppointmentDetail({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const user = await requireCan("appointments", "view");
  const b = await prisma.opBooking.findUnique({ where: { id: bookingId }, include: { patient: true, doctor: true, department: true, room: true, consultation: true } });
  if (!b) notFound();
  const canEdit = can(user.role, "appointments", "edit");

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
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Room</div><div className="font-medium">{b.room?.name ?? "—"}</div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["arrived", "waiting", "in_consultation"].includes(b.status) && <LinkButton href={`/consultations/${b.id}`}>Start consultation</LinkButton>}
        {["booked", "confirmed"].includes(b.status) && <LinkButton href={`/appointments/book?rescheduleFrom=${b.id}`} tone="ghost">Reschedule</LinkButton>}
        {b.consultation && <LinkButton href={`/consultations/${b.id}`} tone="ghost">View consultation</LinkButton>}
        {canEdit && nextBookingStatuses(b.status as BookingStatus).map((s) => (
          <form key={s} action={transitionBooking.bind(null, b.id, s)}>
            <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{s.replace(/_/g, " ")}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
