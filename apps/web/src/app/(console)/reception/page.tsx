import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, Card, SubmitButton } from "@/components/ui";
import { LeadQueue } from "@/components/callcenter/queues";
import { createLead } from "@/lib/leads/actions";

export const dynamic = "force-dynamic";
const OPEN_STAGES = ["new_lead", "contacted", "interested", "not_reachable", "appointment_suggested"];
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default async function ReceptionDesk() {
  const user = await requireCan("calls", "view");
  const scope = branchScopeWhere(user.role, user.branchId);
  const today = new Date(new Date().toISOString().slice(0, 10));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deskWhere: any = { ...scope, desk: "reception" };

  const [open, pending, phoneSource] = await Promise.all([
    prisma.lead.count({ where: { ...deskWhere, stage: { in: OPEN_STAGES } } }),
    prisma.lead.count({ where: { ...deskWhere, followUpDate: { lte: today }, stage: { in: ["contacted", "interested", "not_reachable", "appointment_suggested"] } } }),
    prisma.leadSourceMaster.findFirst({ where: { name: "phone" } }),
  ]);

  return (
    <div>
      <PageHeader title="Reception desk" subtitle="Inbound enquiry & booking calls from patients" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{open}</div><div className="text-xs text-slate-500 dark:text-slate-400">Open enquiries</div></Card>
        <Card><div className="text-2xl font-bold">{pending}</div><div className="text-xs text-slate-500 dark:text-slate-400">Pending callbacks</div></Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Log a walk-in / phone enquiry</h2>
        <form action={createLead} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input type="hidden" name="desk" value="reception" />
          <input type="hidden" name="sourceId" value={phoneSource?.id ?? ""} />
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Name<input name="contactName" required className={input} /></label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Phone<input name="phone" required className={input} /></label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Preferred doctor<input name="preferredDoctor" className={input} /></label>
          <div className="flex items-end"><SubmitButton>Log enquiry</SubmitButton></div>
        </form>
      </Card>

      <div className="mt-6">
        <LeadQueue title="Reception enquiries" where={{ ...deskWhere, stage: { in: OPEN_STAGES } }} />
      </div>
    </div>
  );
}
