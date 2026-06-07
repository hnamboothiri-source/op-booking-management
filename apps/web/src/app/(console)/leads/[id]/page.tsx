import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateLeadStage, logCall } from "@/lib/leads/actions";
import { LEAD_STAGES, isClosedStage, can } from "@prm/core";
import { PageHeader, Badge, Card, SubmitButton, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const CALL_OUTCOMES = [
  "appointment_booked", "follow_up_required", "not_reachable", "call_later",
  "asked_for_doctor_details", "asked_for_treatment_cost", "interested_in_branch_visit",
  "interested_in_admission", "not_interested",
];
const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("leads", "view");
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { source: true, campaign: true, disease: true, branch: true, owner: true, calls: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();

  const canEdit = can(user.role, "leads", "edit");
  const canCall = can(user.role, "calls", "create");

  return (
    <div>
      <PageHeader
        title={lead.contactName}
        subtitle={`${lead.phone} · ${lead.source?.name?.replace(/_/g, " ") ?? "no source"}`}
        action={<LinkButton href={`/appointments/book?leadId=${lead.id}`}>Book appointment</LinkButton>}
      />
      <div className="mb-6"><Link href="/leads" className="text-sm text-slate-500 hover:underline">← Leads</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500">Stage</div><div><Badge tone="blue">{lead.stage.replace(/_/g, " ")}</Badge></div></Card>
        <Card><div className="text-xs text-slate-500">Priority</div><div className="font-medium">{lead.priority}</div></Card>
        <Card><div className="text-xs text-slate-500">Owner</div><div className="font-medium">{lead.owner?.name ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500">Follow-up</div><div className="font-medium">{lead.followUpDate ? lead.followUpDate.toISOString().slice(0, 10) : "—"}</div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {canEdit && (
          <Card>
            <h2 className="mb-3 font-semibold">Update stage</h2>
            <form action={updateLeadStage.bind(null, id)} className="space-y-3">
              <select name="stage" defaultValue={lead.stage} className={input}>
                {LEAD_STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              <input name="closureReason" placeholder="Closure reason (required to close)" defaultValue={lead.closureReason ?? ""} className={input} />
              <p className="text-xs text-slate-400">Closing stages ({LEAD_STAGES.filter(isClosedStage).join(", ").replace(/_/g, " ")}) need a reason.</p>
              <SubmitButton>Save stage</SubmitButton>
            </form>
          </Card>
        )}

        {canCall && (
          <Card>
            <h2 className="mb-3 font-semibold">Log call</h2>
            <form action={logCall.bind(null, id)} className="space-y-3">
              <select name="outcome" className={input}>
                {CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
              <input name="notes" placeholder="Notes" className={input} />
              <label className="block text-xs text-slate-500">Next follow-up date<input type="date" name="followUpDate" className={input} /></label>
              <SubmitButton>Save call</SubmitButton>
            </form>
          </Card>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Call history ({lead.calls.length})</h2>
        <div className="space-y-1">
          {lead.calls.length === 0 && <p className="text-sm text-slate-400">No calls logged.</p>}
          {lead.calls.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
              <span>{c.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {c.outcome.replace(/_/g, " ")}{c.notes ? ` — ${c.notes}` : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
