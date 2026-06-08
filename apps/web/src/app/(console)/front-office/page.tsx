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

  const [dueToday, overdue] = await Promise.all([
    prisma.followUp.count({ where: { ...base, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.followUp.count({ where: { ...base, dueDate: { lt: today } } }),
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
      </div>
    </div>
  );
}
