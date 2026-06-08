import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, slotUtilisation, minutesBetween } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";
import { BarChartCard } from "@/components/charts/BarChartCard";

export const dynamic = "force-dynamic";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const OCCUPYING = ["booked", "confirmed", "arrived", "waiting", "in_consultation", "completed"];

function rangeFor(period: string, now: Date): { from: Date; to: Date; label: string } {
  const d0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === "day") return { from: d0, to: d0, label: iso(d0) };
  if (period === "month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return { from, to, label: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  }
  // week (Mon–Sun)
  const monday = new Date(d0); monday.setUTCDate(d0.getUTCDate() - ((d0.getUTCDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday, to: sunday, label: `${iso(monday)} – ${iso(sunday)}` };
}

export default async function DoctorUtilisation({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireCan("reports", "view");
  const scope = branchScopeWhere(user.role, user.branchId);
  const period = ["day", "week", "month"].includes((await searchParams).period ?? "") ? (await searchParams).period! : "week";
  const { from, to, label } = rangeFor(period, new Date());

  // Count each weekday's occurrences in the range.
  const weekdayCount: Record<number, number> = {};
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) weekdayCount[d.getUTCDay()] = (weekdayCount[d.getUTCDay()] ?? 0) + 1;

  const [doctors, schedules, bookings] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true, opDoctor: true }, orderBy: { name: "asc" } }),
    prisma.doctorSchedule.findMany({ where: { active: true } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.findMany({ where: { ...scope, appointmentDate: { gte: from, lte: to } } as any, select: { doctorId: true, status: true } }),
  ]);

  const rows = doctors.map((d) => {
    const mySch = schedules.filter((s) => s.doctorId === d.id && s.dayOfWeek !== null);
    let allotted = 0, mins = 0;
    for (const s of mySch) {
      const occ = weekdayCount[s.dayOfWeek as number] ?? 0;
      allotted += occ * (s.slotsCount ?? s.maxPatientsPerSlot ?? 1);
      mins += occ * minutesBetween(s.startTime, s.endTime);
    }
    const mine = bookings.filter((b) => b.doctorId === d.id);
    const booked = mine.filter((b) => OCCUPYING.includes(b.status)).length;
    const consulted = mine.filter((b) => b.status === "completed").length;
    const noShow = mine.filter((b) => b.status === "no_show").length;
    return { id: d.id, name: d.name, allotted, hours: Math.round((mins / 60) * 10) / 10, booked, consulted, noShow, util: slotUtilisation(booked, allotted) };
  }).filter((r) => r.allotted > 0 || r.booked > 0).sort((a, b) => b.util - a.util);

  const pill = (p: string) => `rounded-full px-3 py-1 text-sm ${period === p ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`;
  const th = "px-4 py-2 text-left font-medium"; const td = "px-4 py-2";

  return (
    <div>
      <PageHeader title="Doctor slot utilisation" subtitle={`Allotted hours/slots vs used & patients consulted · ${label}`} />
      <div className="mb-4"><Link href="/reports" className="text-sm text-slate-500 hover:underline">← Reports</Link></div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["day", "week", "month"].map((p) => <Link key={p} href={`/reports/doctor-utilisation?period=${p}`} className={pill(p)}>{p}</Link>)}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Utilisation % by doctor</div>
          <BarChartCard data={rows.slice(0, 12).map((r) => ({ label: r.name.replace(/^Dr\.?\s*/, ""), value: r.util }))} height={Math.max(160, rows.slice(0, 12).length * 26)} />
        </Card>
        <Card>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Patients consulted by doctor</div>
          <BarChartCard data={rows.filter((r) => r.consulted > 0).slice(0, 12).map((r) => ({ label: r.name.replace(/^Dr\.?\s*/, ""), value: r.consulted }))} height={160} alt />
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr><th className={th}>Doctor</th><th className={th}>Allotted slots</th><th className={th}>Allotted hrs</th><th className={th}>Booked</th><th className={th}>Consulted</th><th className={th}>No-show</th><th className={th}>Utilisation</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className={td}><Link href={`/appointments/doctor/${r.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{r.name}</Link></td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.allotted}</td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.hours}h</td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.booked}</td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.consulted}</td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.noShow}</td>
                <td className={td}><Badge tone={r.util >= 70 ? "green" : r.util >= 30 ? "amber" : "slate"}>{r.util}%</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No allotment in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Allotted = scheduled session slots × weekday occurrences in the period (nth-week rotations counted per weekday — approximate).</p>
    </div>
  );
}
