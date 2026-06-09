import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { weekOfMonth, isNewBooking, isConversion } from "@prm/core";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function monthRange(ym: string): { start: Date; end: Date; label: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end, label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) };
}

export default async function BookingChart({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireCan("appointments", "view");
  const { month } = await searchParams;
  const ym = month ?? new Date().toISOString().slice(0, 7);
  const { start, end, label } = monthRange(ym);

  const [doctors, bookings] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true, opDoctor: true }, orderBy: { name: "asc" } }),
    prisma.opBooking.findMany({ where: { appointmentDate: { gte: start, lt: end }, status: { notIn: ["cancelled", "rescheduled"] } } }),
  ]);

  const rows = doctors.map((d) => {
    const docB = bookings.filter((b) => b.doctorId === d.id);
    const weeks = [0, 0, 0, 0, 0];
    let newC = 0, fuC = 0, conv = 0;
    for (const b of docB) {
      const w = Math.min(5, weekOfMonth(b.appointmentDate)) - 1;
      weeks[w] += 1;
      if (isNewBooking(b.appointmentType)) newC += 1; else fuC += 1;
      if (isConversion(b.requestedDoctorId, b.doctorId)) conv += 1;
    }
    return { id: d.id, name: d.name, weeks, total: docB.length, newC, fuC, conv, newPct: d.newTargetPct, fuPct: d.followupTargetPct };
  }).filter((r) => r.total > 0);

  const prevYm = (() => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); })();
  const nextYm = (() => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7); })();

  return (
    <div>
      <PageHeader title="Doctor booking chart" subtitle="Month / week OP bookings per doctor — new vs follow-up & conversions" />
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link href={`/appointments/booking-chart?month=${prevYm}`} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">← Prev</Link>
        <span className="font-medium">{label}</span>
        <Link href={`/appointments/booking-chart?month=${nextYm}`} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">Next →</Link>
        <Link href="/appointments/board" className="ml-2 text-rose-700 hover:underline">Booking board →</Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Doctor</th>{["W1", "W2", "W3", "W4", "W5"].map((w) => <th key={w} className="px-2 py-2 text-right">{w}</th>)}<th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">New</th><th className="px-3 py-2 text-right">Follow-up</th><th className="px-3 py-2 text-right">Mix (tgt)</th><th className="px-3 py-2 text-right">Conv.</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-400">No bookings in {label}.</td></tr>}
            {rows.map((r) => {
              const mix = r.total ? Math.round((r.newC / r.total) * 100) : 0;
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  {r.weeks.map((w, i) => <td key={i} className="px-2 py-2 text-right text-slate-600">{w || "·"}</td>)}
                  <td className="px-3 py-2 text-right font-medium">{r.total}</td>
                  <td className="px-3 py-2 text-right">{r.newC}</td>
                  <td className="px-3 py-2 text-right">{r.fuC}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{mix}% / {r.newPct}%</td>
                  <td className="px-3 py-2 text-right">{r.conv || "·"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">"Mix (tgt)" = actual new-booking % vs the doctor's new-target %. "Conv." = bookings where the patient asked for another doctor.</p>
    </div>
  );
}
