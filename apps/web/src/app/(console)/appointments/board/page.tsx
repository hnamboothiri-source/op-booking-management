import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { targetSplit, needsMorePatients, isConversion, isNewBooking, slotUtilisation } from "@prm/core";
import { daySlots } from "@/lib/appointments/slots";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const midnight = (s: string) => new Date(`${s}T00:00:00.000Z`);

export default async function BookingBoard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireCan("appointments", "view");
  const { date } = await searchParams;
  const dateStr = date ?? new Date().toISOString().slice(0, 10);

  // Availability is DERIVED LIVE from the master weekly schedule — no slot generation needed.
  const [{ byDoctor }, doctors, bookings, rooms] = await Promise.all([
    daySlots(dateStr),
    prisma.doctor.findMany(),
    prisma.opBooking.findMany({ where: { appointmentDate: midnight(dateStr), status: { notIn: ["cancelled", "no_show", "rescheduled"] } } }),
    prisma.consultationRoom.findMany(),
  ]);
  const roomName = (id: string | null | undefined) => rooms.find((r) => r.id === id)?.code ?? rooms.find((r) => r.id === id)?.name ?? null;
  const docName = (id: string) => doctors.find((d) => d.id === id)?.name ?? id;

  const rows = byDoctor.map((g) => {
    const doc = doctors.find((d) => d.id === g.doctorId);
    const docBookings = bookings.filter((b) => b.doctorId === g.doctorId);
    const bookedTotal = Math.max(g.booked, docBookings.length);
    const newB = docBookings.filter((b) => isNewBooking(b.appointmentType)).length;
    const fuB = docBookings.length - newB;
    const conversions = docBookings.filter((b) => isConversion(b.requestedDoctorId, b.doctorId)).length;
    const { newTarget, followupTarget } = targetSplit(g.allotted, doc?.newTargetPct ?? 70, doc?.followupTargetPct ?? 30);
    return {
      id: g.doctorId, name: doc?.name ?? g.doctorId, role: doc?.role ?? null, room: roomName(g.roomId),
      substituteFor: g.substituteFor ? docName(g.substituteFor) : null,
      allotted: g.allotted, booked: bookedTotal, newB, fuB, newTarget, followupTarget, conversions,
      remaining: Math.max(0, g.allotted - bookedTotal), fill: slotUtilisation(bookedTotal, g.allotted),
      needs: needsMorePatients(bookedTotal, g.allotted),
    };
  }).sort((a, b) => (a.needs === b.needs ? a.fill - b.fill : a.needs ? -1 : 1));

  const openCapacity = rows.reduce((s, r) => s + r.remaining, 0);
  const needing = rows.filter((r) => r.needs).length;
  const conversionsToday = rows.reduce((s, r) => s + r.conversions, 0);

  return (
    <div>
      <PageHeader title="OP booking board" subtitle="Today's consulting doctors, capacity & who needs more patients (call-centre desk)" />
      <form className="mb-4 flex items-center gap-2 text-sm">
        <label>Date <input type="date" name="date" defaultValue={dateStr} className="rounded-md border border-slate-300 px-2 py-1" /></label>
        <button className="rounded-md bg-rose-600 px-3 py-1 text-white">Go</button>
        <Link href="/appointments/grid" className="ml-2 text-rose-700 hover:underline">Room × Day grid →</Link>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card accent><div className="text-[11px] uppercase text-slate-400">Consulting doctors</div><div className="text-2xl font-bold">{rows.length}</div></Card>
        <Card accent><div className="text-[11px] uppercase text-slate-400">Open capacity</div><div className="text-2xl font-bold text-emerald-600">{openCapacity}</div></Card>
        <Card accent><div className="text-[11px] uppercase text-slate-400">Need more patients</div><div className="text-2xl font-bold text-amber-600">{needing}</div></Card>
        <Card accent><div className="text-[11px] uppercase text-slate-400">Conversions</div><div className="text-2xl font-bold">{conversionsToday}</div></Card>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Doctor</th><th className="px-3 py-2">Room</th><th className="px-3 py-2 text-right">Allotted</th><th className="px-3 py-2 text-right">Booked</th><th className="px-3 py-2 text-right">New (tgt)</th><th className="px-3 py-2 text-right">F/up (tgt)</th><th className="px-3 py-2 text-right">Fill</th><th className="px-3 py-2 text-right">Conv.</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">No doctors scheduled for {dateStr} in the master schedule. <Link href="/appointments/grid" className="text-rose-700 underline">Edit Room × Day grid</Link>.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${r.needs ? "bg-amber-50/50" : ""}`}>
                <td className="px-3 py-2"><span className="font-medium">{r.name}</span>{r.needs && <Badge tone="amber">needs patients</Badge>}{r.substituteFor && <Badge tone="blue">covering {r.substituteFor}</Badge>}<div className="text-[11px] text-slate-400">{r.role?.replace(/_/g, " ")}</div></td>
                <td className="px-3 py-2 text-slate-600">{r.room ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.allotted}</td>
                <td className="px-3 py-2 text-right font-medium">{r.booked}</td>
                <td className="px-3 py-2 text-right">{r.newB}<span className="text-slate-400"> / {r.newTarget}</span></td>
                <td className="px-3 py-2 text-right">{r.fuB}<span className="text-slate-400"> / {r.followupTarget}</span></td>
                <td className={`px-3 py-2 text-right font-medium ${r.fill < 60 ? "text-amber-600" : "text-emerald-600"}`}>{r.fill}%</td>
                <td className="px-3 py-2 text-right">{r.conversions}</td>
                <td className="px-3 py-2 text-right"><Link href={`/appointments/book?doctorId=${r.id}&date=${dateStr}`} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50">Book →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Doctors needing patients are highlighted — steer flexible patients to them. "Conv." = patients who asked for another doctor but were booked here.</p>
    </div>
  );
}
