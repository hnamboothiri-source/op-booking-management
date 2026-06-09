import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { slotUtilisation, minutesBetween } from "@prm/core";
import { daySlots } from "@/lib/appointments/slots";
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

  const [{ cells }, bookings, rooms] = await Promise.all([
    daySlots(dateStr),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.findMany({ where: { appointmentDate: date, doctorId } as any }),
    prisma.consultationRoom.findMany({ where: { active: true } }),
  ]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  // Slots for THIS doctor on the date, derived live from the master schedule.
  const mySlots = cells.filter((c) => c.doctorId === doctorId).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const allotted = mySlots.length;
  const allottedMins = mySlots.reduce((m, s) => m + minutesBetween(s.startTime, s.endTime), 0);
  const booked = mySlots.filter((s) => s.booked).length;
  const consulted = bookings.filter((b) => b.status === "completed").length;
  const noShow = bookings.filter((b) => b.status === "no_show").length;
  const util = slotUtilisation(booked, allotted);

  const agenda: AgendaDoctor[] = mySlots.length === 0 ? [] : [{
    id: doctorId, name: doctor.name, role: doctor.role ?? null,
    room: roomName.get(mySlots[0].roomId ?? "") ?? null,
    windowLabel: `${mySlots[0].startTime}–${mySlots[mySlots.length - 1].endTime}`,
    allotted, booked, utilisation: util,
    slots: mySlots.map((c) => ({
      id: `${c.doctorId}-${c.startTime}`, startTime: c.startTime, endTime: c.endTime,
      status: c.booked ? (c.bookingStatus ?? "booked") : "open", patientName: c.patientName ?? null,
      href: c.bookingId ? `/appointments/${c.bookingId}` : `/appointments/book?doctorId=${doctorId}&date=${dateStr}&startTime=${c.startTime}`,
    })),
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
