import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { FollowUpQueue } from "@/components/callcenter/queues";

export const dynamic = "force-dynamic";
const ACTIVE_STATUS = ["pending", "booked"];

export default async function FrontOfficeDesk() {
  await requireCan("follow_ups", "view");
  const today = new Date(new Date().toISOString().slice(0, 10));
  const tomorrow = new Date(today.getTime() + 86400000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any = { desk: "front_office", status: { in: ACTIVE_STATUS } };

  const [dueToday, overdue, remarks] = await Promise.all([
    prisma.followUp.count({ where: { ...base, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.followUp.count({ where: { ...base, dueDate: { lt: today } } }),
    prisma.consultation.findMany({ where: { staffRemarks: { not: null } }, include: { patient: true, doctor: true }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  return (
    <div>
      <PageHeader title="Front Office desk" subtitle="Outbound review calls to previously-consulted patients" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{dueToday}</div><div className="text-xs text-slate-500 dark:text-slate-400">Due today</div></Card>
        <Card><div className="text-2xl font-bold text-amber-600">{overdue}</div><div className="text-xs text-slate-500 dark:text-slate-400">Overdue</div></Card>
      </div>

      <div className="space-y-6">
        <FollowUpQueue title="Due today" overdue={false} where={{ ...base, dueDate: { gte: today, lt: tomorrow } }} />
        <FollowUpQueue title="Overdue review calls" overdue where={{ ...base, dueDate: { lt: today } }} />

        <Card>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent doctor remarks for the desk</h2>
          {remarks.length === 0 ? <p className="text-sm text-slate-400">No remarks.</p> : (
            <div className="space-y-1">
              {remarks.map((c) => (
                <div key={c.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <Link href={`/patients/${encodeURIComponent(c.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{c.patient.name}</Link>
                  <span className="text-xs text-slate-400"> · {c.doctor.name} · {c.createdAt.toISOString().slice(0, 10)}</span>
                  <div className="text-slate-700 dark:text-slate-200">{c.staffRemarks}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
