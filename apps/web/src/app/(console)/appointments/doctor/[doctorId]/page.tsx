import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { slotUtilisation, minutesBetween } from "@prm/core";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { DayAgenda, type AgendaDoctor } from "@/components/appointments/DayAgenda";

export const dynamic = "force-dynamic";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ROLE_LABEL: Record<string, string> = { chief_physician: "Chief Physician", dy_chief_physician: "Dy Chief Physician", cmo: "CMO", consultant: "Consultant", medical_officer: "Medical Officer" };

export default async function DoctorDay({ params, searchParams }: { params: Promise<{ doctorId: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireCan("appointments", "view");
  const { doctorId } = await params;
  const dateStr = (await searchParams).date ?? iso(new Date());
  const date = new Date(dateStr);

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) notFound();

  const [slots, bookings, rooms] = await Promise.all([
    prisma.timeSlot.findMany({ where: { slotDate: date, doctorId }, orderBy: { startTime: "asc" } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.findMany({ where: { appointmentDate: date, doctorId } as any, include: { patient: true } }),
    prisma.consultationRoom.findMany({ where: { active: true } }),
  ]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const bySlot = new Map(bookings.filter((b) => b.timeSlotId).map((b) => [b.timeSlotId as string, b]));

  const allotted = slots.length;
  const allottedMins = slots.reduce((m, s) => m + minutesBetween(s.startTime, s.endTime), 0);
  const booked = slots.filter((s) => s.bookedCount > 0).length;
  const consulted = bookings.filter((b) => b.status === "completed").length;
  const noShow = bookings.filter((b) => b.status === "no_show").length;
  const util = slotUtilisation(booked, allotted);

  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const agenda: AgendaDoctor[] = slots.length === 0 ? [] : [{
    id: doctorId, name: doctor.name, role: doctor.role ?? null,
    room: roomName.get(slots[0].roomId ?? "") ?? null,
    windowLabel: `${sorted[0].startTime}–${sorted[sorted.length - 1].endTime}`,
    allotted, booked, utilisation: util,
    slots: sorted.map((s) => {
      const b = bySlot.get(s.id);
      const status = s.status === "blocked" ? "blocked" : b ? b.status : s.bookedCount >= s.capacity ? "full" : "open";
      return { id: s.id, startTime: s.startTime, endTime: s.endTime, status, patientName: b?.patient?.name ?? null, href: b ? `/appointments/${b.id}` : s.status !== "blocked" && s.bookedCount < s.capacity ? `/appointments/book?slotId=${s.id}` : undefined };
    }),
  }];

  const stat = (label: string, value: React.ReactNode) => (
    <Card><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500 dark:text-slate-400">{label}</div></Card>
  );

  return (
    <div>
      <PageHeader title={doctor.name} subtitle={`${doctor.role ? ROLE_LABEL[doctor.role] ?? doctor.role : "Doctor"} · ${date.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" })}`} action={<LinkButton href={`/appointments/calendar?date=${dateStr}`} tone="ghost">← Calendar</LinkButton>} />

      <form action={`/appointments/doctor/${doctorId}`} className="mb-4 flex items-center gap-2 text-sm">
        <label className="text-slate-500">Date</label>
        <input type="date" name="date" defaultValue={dateStr} className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" />
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Go</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stat("Slots allotted", allotted)}
        {stat("Hours allotted", `${Math.round((allottedMins / 60) * 10) / 10}h`)}
        {stat("Booked", booked)}
        {stat("Consulted", consulted)}
        {stat("No-show", noShow)}
        {stat("Utilisation", `${util}%`)}
      </div>

      <DayAgenda doctors={agenda} />
    </div>
  );
}
