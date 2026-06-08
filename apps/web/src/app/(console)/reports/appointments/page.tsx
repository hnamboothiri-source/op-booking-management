import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, funnelRate } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";
import { BarChartCard } from "@/components/charts/BarChartCard";

export const dynamic = "force-dynamic";

const SHOW = ["booked", "arrived", "completed", "cancelled", "no_show"];

export default async function AppointmentReport() {
  const user = await requireCan("reports", "view");
  const scope = branchScopeWhere(user.role, user.branchId);

  const [bookings, doctors, branches, slots] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.findMany({ where: scope as any, select: { doctorId: true, branchId: true, status: true, source: true } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.timeSlot.findMany({ select: { capacity: true, bookedCount: true, doctorId: true } }),
  ]);

  const total = bookings.length;
  const countBy = (pred: (b: typeof bookings[number]) => boolean) => bookings.filter(pred).length;

  const tally = (rows: typeof bookings) => {
    const counts: Record<string, number> = {};
    for (const s of SHOW) counts[s] = rows.filter((b) => b.status === s).length;
    return counts;
  };

  // Doctor-wise.
  const doctorRows = doctors.map((d) => {
    const mine = bookings.filter((b) => b.doctorId === d.id);
    return { id: d.id, name: d.name, target: d.dailyTarget ?? null, total: mine.length, counts: tally(mine) };
  }).filter((r) => r.total > 0);

  // Branch-wise.
  const branchRows = branches.map((b) => {
    const mine = bookings.filter((x) => x.branchId === b.id);
    return { id: b.id, name: b.name, total: mine.length, counts: tally(mine) };
  }).filter((r) => r.total > 0);

  // No-show analysis.
  const noShow = countBy((b) => b.status === "no_show");
  const noShowPct = funnelRate(noShow, total);
  const noShowBySource = [...new Set(bookings.map((b) => b.source))].map((src) => ({ label: src.replace(/_/g, " "), value: countBy((b) => b.source === src && b.status === "no_show") })).filter((r) => r.value > 0);

  // Slot utilization.
  const cap = slots.reduce((s, x) => s + (x.capacity ?? 0), 0);
  const booked = slots.reduce((s, x) => s + (x.bookedCount ?? 0), 0);
  const utilization = funnelRate(booked, cap);

  // Walk-in vs booked.
  const walkIn = countBy((b) => b.source === "front_desk");
  const preBooked = total - walkIn;

  // Lead → appointment → consultation funnel.
  const arrived = countBy((b) => ["arrived", "in_consultation", "completed"].includes(b.status));
  const completed = countBy((b) => b.status === "completed");

  const th = "px-4 py-2 text-left font-medium";
  const td = "px-4 py-2";

  return (
    <div>
      <PageHeader title="Appointment report" subtitle="Doctor · branch · no-show · slot utilisation · walk-in vs booked (Module 3 §20)" />
      <div className="mb-4"><Link href="/reports" className="text-sm text-slate-500 hover:underline">← Reports</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{total}</div><div className="text-xs text-slate-500 dark:text-slate-400">Total appointments</div></Card>
        <Card><div className="text-2xl font-bold text-red-600">{noShowPct}%</div><div className="text-xs text-slate-500 dark:text-slate-400">No-show rate ({noShow})</div></Card>
        <Card><div className="text-2xl font-bold">{utilization}%</div><div className="text-xs text-slate-500 dark:text-slate-400">Slot utilisation ({booked}/{cap})</div></Card>
        <Card><div className="text-2xl font-bold">{walkIn}<span className="text-base font-normal text-slate-400"> / {preBooked}</span></div><div className="text-xs text-slate-500 dark:text-slate-400">Walk-in / pre-booked</div></Card>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Doctor-wise appointments</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={th}>Doctor</th><th className={th}>Target</th>{SHOW.map((s) => <th key={s} className={th}>{s.replace(/_/g, " ")}</th>)}</tr></thead>
            <tbody>
              {doctorRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className={`${td} font-medium`}>{r.name}</td>
                  <td className={td}>{r.target != null ? <Badge tone={r.counts.completed >= r.target ? "green" : "amber"}>{r.counts.completed}/{r.target}</Badge> : "—"}</td>
                  {SHOW.map((s) => <td key={s} className={td}>{r.counts[s] > 0 ? <DrillCount value={r.counts[s]} entity="appointments" filters={{ doctorId: r.id, status: s }} label={`${r.name} · ${s}`} /> : <span className="text-slate-300 dark:text-slate-600">0</span>}</td>)}
                </tr>
              ))}
              {doctorRows.length === 0 && <tr><td colSpan={SHOW.length + 2} className="px-4 py-6 text-center text-slate-400">No appointments.</td></tr>}
            </tbody>
          </table>
        </div>
        <Link href="/api/reports/export?type=appointments-by-status" className="mt-2 inline-block text-xs text-rose-600 hover:underline dark:text-rose-300">Export CSV ↓</Link>
      </section>

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Branch-wise appointments</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={th}>Branch</th>{SHOW.map((s) => <th key={s} className={th}>{s.replace(/_/g, " ")}</th>)}</tr></thead>
              <tbody>
                {branchRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className={`${td} font-medium`}>{r.name}</td>
                    {SHOW.map((s) => <td key={s} className={td}>{r.counts[s] > 0 ? <DrillCount value={r.counts[s]} entity="appointments" filters={{ branchId: r.id, status: s }} label={`${r.name} · ${s}`} /> : <span className="text-slate-300 dark:text-slate-600">0</span>}</td>)}
                  </tr>
                ))}
                {branchRows.length === 0 && <tr><td colSpan={SHOW.length + 1} className="px-4 py-6 text-center text-slate-400">No appointments.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Funnel & no-show by source</h2>
          <Card>
            <BarChartCard data={[{ label: "Appointments", value: total }, { label: "Arrived", value: arrived }, { label: "Completed", value: completed }]} height={140} />
            <div className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">No-show by source</div>
            <BarChartCard data={noShowBySource} height={140} color="#b91c1c" />
          </Card>
        </div>
      </section>
    </div>
  );
}
