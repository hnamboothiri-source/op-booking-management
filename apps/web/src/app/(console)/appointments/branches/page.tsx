import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, LinkButton } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const STATUS_COLS = [
  { key: "booked", label: "Booked" },
  { key: "arrived", label: "Arrived" },
  { key: "waiting", label: "Waiting" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no_show", label: "No-show" },
];

export default async function BranchDashboard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireCan("appointments", "view");
  const dateStr = (await searchParams).date ?? iso(new Date());
  const date = new Date(dateStr);
  const scope = branchScopeWhere(user.role, user.branchId);

  const branches = await prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  const rows = await Promise.all(branches.map(async (b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dayWhere = { ...scope, branchId: b.id, appointmentDate: date } as any;
    const todays = await prisma.opBooking.findMany({ where: dayWhere, select: { doctorId: true, status: true } });
    const counts: Record<string, number> = {};
    for (const t of todays) counts[t.status] = (counts[t.status] ?? 0) + 1;
    const doctorsOn = new Set(todays.map((t) => t.doctorId)).size;
    return { id: b.id, name: b.name, doctorsOn, counts };
  }));

  const th = "px-4 py-2 text-left font-medium";
  const td = "px-4 py-2";

  return (
    <div>
      <PageHeader title="Branch schedule dashboard" subtitle={`Appointments on ${dateStr}`} action={<LinkButton href="/appointments" tone="ghost">← Worklist</LinkButton>} />

      <form className="mb-4 flex items-center gap-2 text-sm" action="/appointments/branches">
        <label className="text-slate-500">Date</label>
        <input type="date" name="date" defaultValue={dateStr} className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800" />
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Go</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr><th className={th}>Branch</th><th className={th}>Doctors on</th>{STATUS_COLS.map((c) => <th key={c.key} className={th}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className={`${td} font-medium`}>{r.name}</td>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.doctorsOn}</td>
                {STATUS_COLS.map((c) => (
                  <td key={c.key} className={td}>
                    {(r.counts[c.key] ?? 0) > 0
                      ? <DrillCount value={r.counts[c.key]} entity="appointments" filters={{ branchId: r.id, status: c.key, date: dateStr }} label={`${r.name} · ${c.label}`} />
                      : <span className="text-slate-300 dark:text-slate-600">0</span>}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No branches.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
