import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, Card } from "@/components/ui";
import { LeadQueue } from "@/components/callcenter/queues";

export const dynamic = "force-dynamic";
const OPEN_STAGES = ["new_lead", "contacted", "interested", "not_reachable", "appointment_suggested"];

export default async function BackOfficeDesk() {
  const user = await requireCan("calls", "view");
  const scope = branchScopeWhere(user.role, user.branchId);
  const today = new Date(new Date().toISOString().slice(0, 10));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deskWhere: any = { ...scope, desk: "back_office" };

  const [newLeads, pending, openLeads] = await Promise.all([
    prisma.lead.count({ where: { ...deskWhere, stage: "new_lead" } }),
    prisma.lead.count({ where: { ...deskWhere, followUpDate: { lte: today }, stage: { in: ["contacted", "interested", "not_reachable", "appointment_suggested"] } } }),
    prisma.lead.findMany({ where: { ...deskWhere, stage: { in: OPEN_STAGES } }, include: { source: true } }),
  ]);

  // Source-wise mini breakdown.
  const bySource = new Map<string, number>();
  for (const l of openLeads) {
    const name = (l.source?.name ?? "other").replace(/_/g, " ");
    bySource.set(name, (bySource.get(name) ?? 0) + 1);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader title="Back Office desk" subtitle="Outbound calls to acquired leads — ads, email, WhatsApp, social" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{newLeads}</div><div className="text-xs text-slate-500 dark:text-slate-400">New leads</div></Card>
        <Card><div className="text-2xl font-bold">{pending}</div><div className="text-xs text-slate-500 dark:text-slate-400">Pending callbacks</div></Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">By source</div>
          <div className="mt-1 space-y-0.5 text-sm">
            {sources.length === 0 ? <span className="text-slate-400">—</span> : sources.map(([n, c]) => (
              <div key={n} className="flex justify-between gap-2"><span className="capitalize text-slate-600 dark:text-slate-300">{n}</span><span className="font-medium">{c}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <LeadQueue title="Back-office leads" where={{ ...deskWhere, stage: { in: OPEN_STAGES } }} />
    </div>
  );
}
