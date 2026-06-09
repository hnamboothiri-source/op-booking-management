import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { conversionRate, overdueBucketLabel, isConversionOutcome, FOLLOWUP_OUTCOME_LABELS, type FollowUpOutcome } from "@prm/core";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";

export const dynamic = "force-dynamic";
const startOfToday = () => new Date(new Date().toISOString().slice(0, 10));
const daysOverdue = (d: Date) => Math.floor((startOfToday().getTime() - new Date(new Date(d).toISOString().slice(0, 10)).getTime()) / 86400000);
const OPEN = ["pending", "booked", "overdue"];

export default async function FollowUpReports() {
  await requireCan("follow_ups", "view");
  const today = startOfToday();

  const [followUps, activities, staff] = await Promise.all([
    prisma.followUp.findMany({ select: { id: true, ownerId: true, status: true, dueDate: true, type: true, linkedBookingId: true } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.followUpActivity.findMany({ select: { followUpId: true, outcome: true } }).catch(() => []) as Promise<{ followUpId: string; outcome: string }[]>),
    prisma.staffUser.findMany({ where: { active: true } }),
  ]);
  const ownerName = (id: string | null | undefined) => staff.find((s) => s.id === id)?.name ?? "Unassigned";

  // Conversion = follow-up has a conversion-outcome activity OR a linked booking.
  const convertedFu = new Set<string>();
  for (const f of followUps) if (f.linkedBookingId) convertedFu.add(f.id);
  for (const a of activities) if (isConversionOutcome(a.outcome as FollowUpOutcome)) convertedFu.add(a.followUpId);

  const dueToday = followUps.filter((f) => OPEN.includes(f.status) && new Date(new Date(f.dueDate).toISOString().slice(0, 10)).getTime() === today.getTime()).length;
  const overdue = followUps.filter((f) => OPEN.includes(f.status) && f.dueDate < today);

  // Overdue ageing buckets.
  const buckets = new Map<string, number>();
  for (const f of overdue) { const b = overdueBucketLabel(daysOverdue(f.dueDate)); buckets.set(b, (buckets.get(b) ?? 0) + 1); }
  const bucketOrder = ["1 day", "2–3 days", "4–7 days", "More than 7 days"];

  // Executive productivity.
  const owners = new Map<string, { assigned: number; completed: number; overdue: number; converted: number }>();
  for (const f of followUps) {
    const g = owners.get(f.ownerId ?? "") ?? { assigned: 0, completed: 0, overdue: 0, converted: 0 };
    g.assigned += 1;
    if (f.status === "done") g.completed += 1;
    if (OPEN.includes(f.status) && f.dueDate < today) g.overdue += 1;
    if (convertedFu.has(f.id)) g.converted += 1;
    owners.set(f.ownerId ?? "", g);
  }

  // Ayurveda compliance — outcome tallies.
  const outcomeCount = new Map<string, number>();
  for (const a of activities) outcomeCount.set(a.outcome, (outcomeCount.get(a.outcome) ?? 0) + 1);
  const complianceRows: [FollowUpOutcome, FollowUpOutcome][] = [
    ["medicine_taken_regularly", "medicine_stopped"],
    ["therapy_completed", "therapy_missed"],
    ["improvement_reported", "no_improvement_reported"],
  ];

  return (
    <div>
      <PageHeader title="Follow-up reports" subtitle="Due / overdue ageing, executive productivity, conversion & Ayurveda compliance" action={<LinkButton href="/follow-ups" tone="ghost">← Follow-ups</LinkButton>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Due today" value={dueToday} entity="followups" filters={{ due: "today" }} />
        <DrillStat label="Overdue" value={overdue.length} entity="followups" filters={{ due: "overdue" }} />
        <DrillStat label="Converted" value={convertedFu.size} entity="followups" filters={{}} />
        <Card><div className="text-2xl font-bold">{conversionRate(convertedFu.size, followUps.length)}%</div><div className="text-xs text-slate-500 dark:text-slate-400">Follow-up → visit conversion</div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Overdue ageing</div>
          <table className="w-full text-sm"><tbody>
            {overdue.length === 0 && <tr><td className="px-4 py-3 text-slate-400">No overdue follow-ups.</td></tr>}
            {bucketOrder.filter((b) => buckets.has(b)).map((b) => (
              <tr key={b} className="border-t border-slate-100 dark:border-slate-700"><td className="px-4 py-2">{b}</td><td className="px-4 py-2 text-right font-medium">{buckets.get(b)}</td></tr>
            ))}
          </tbody></table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Ayurveda compliance</div>
          <table className="w-full text-sm"><tbody>
            {complianceRows.map(([good, bad]) => (
              <tr key={good} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">{FOLLOWUP_OUTCOME_LABELS[good]} <span className="text-slate-400">vs</span> {FOLLOWUP_OUTCOME_LABELS[bad]}</td>
                <td className="px-4 py-2 text-right"><span className="text-emerald-600">{outcomeCount.get(good) ?? 0}</span> / <span className="text-amber-600">{outcomeCount.get(bad) ?? 0}</span></td>
              </tr>
            ))}
            <tr className="border-t border-slate-100 dark:border-slate-700"><td className="px-4 py-2">Side effects reported</td><td className="px-4 py-2 text-right text-red-600">{outcomeCount.get("side_effect_reported") ?? 0}</td></tr>
          </tbody></table>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">Executive productivity</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Executive</th><th className="px-4 py-2 text-right">Assigned</th><th className="px-4 py-2 text-right">Completed</th><th className="px-4 py-2 text-right">Overdue</th><th className="px-4 py-2 text-right">Conversion</th></tr></thead>
          <tbody>
            {[...owners.entries()].sort((a, b) => b[1].assigned - a[1].assigned).map(([id, g]) => (
              <tr key={id || "none"} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">{ownerName(id)}</td>
                <td className="px-4 py-2 text-right">{g.assigned}</td>
                <td className="px-4 py-2 text-right">{g.completed}</td>
                <td className="px-4 py-2 text-right text-amber-600">{g.overdue}</td>
                <td className="px-4 py-2 text-right font-medium">{conversionRate(g.converted, g.assigned)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
