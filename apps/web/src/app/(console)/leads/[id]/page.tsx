import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateLeadStage, logCall, transferLead, mergeLead } from "@/lib/leads/actions";
import { LEAD_STAGES, isClosedStage, can } from "@prm/core";
import { PageHeader, Badge, Card, SubmitButton, LinkButton } from "@/components/ui";
import { LeadTierBadge } from "@/components/leads/TierBadge";

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
  const [lead, staff, activities, branches, communications, bookings, assignments] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: { source: true, campaign: true, disease: true, branch: true, owner: true, calls: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.leadActivity.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }).catch(() => []),
    prisma.communicationLog.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.opBooking.findMany({ where: { leadId: id }, orderBy: { bookedAt: "desc" }, take: 50 }),
    prisma.leadAssignment.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  if (!lead) notFound();

  const canEdit = can(user.role, "leads", "edit");
  const canCall = can(user.role, "calls", "create");

  // Merge all events into one chronological timeline (FRS §8).
  type Ev = { at: Date; kind: string; text: string };
  const events: Ev[] = [
    ...activities.map((a) => ({ at: a.createdAt as Date, kind: a.kind, text: a.detail ? `${a.summary} — ${a.detail}` : a.summary })),
    ...lead.calls.map((c) => ({ at: c.createdAt as Date, kind: "call", text: `Call — ${c.outcome.replace(/_/g, " ")}${c.notes ? ` — ${c.notes}` : ""}` })),
    ...communications.map((m) => ({ at: (m.sentAt ?? m.createdAt) as Date, kind: "message", text: `${m.channel.replace(/_/g, " ")} — ${m.status}${m.body ? `: ${m.body.slice(0, 60)}` : ""}` })),
    ...bookings.map((b) => ({ at: b.bookedAt as Date, kind: "follow_up", text: `Appointment ${b.status.replace(/_/g, " ")}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const TONE: Record<string, string> = {
    created: "bg-blue-500", assigned: "bg-violet-500", call: "bg-emerald-500", message: "bg-sky-500",
    stage_change: "bg-rose-500", note: "bg-slate-400", follow_up: "bg-amber-500", transfer: "bg-orange-500", merge: "bg-fuchsia-500",
  };

  return (
    <div>
      <PageHeader
        title={lead.contactName}
        subtitle={`${lead.leadNumber ? lead.leadNumber + " · " : ""}${lead.phone} · ${lead.source?.name?.replace(/_/g, " ") ?? "no source"}`}
        action={<LinkButton href={`/appointments/book?leadId=${lead.id}`}>Book appointment</LinkButton>}
      />
      <div className="mb-6"><Link href="/leads" className="text-sm text-slate-500 hover:underline">← Leads</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500">Stage</div><div><Badge tone="blue">{lead.stage.replace(/_/g, " ")}</Badge></div></Card>
        <Card><div className="text-xs text-slate-500">Priority / SLA</div><div className="mt-1"><LeadTierBadge lead={lead} now={new Date()} /></div></Card>
        <Card><div className="text-xs text-slate-500">Owner</div><div className="font-medium">{lead.owner?.name ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500">Follow-up</div><div className="font-medium">{lead.followUpDate ? lead.followUpDate.toISOString().slice(0, 10) : "—"}</div></Card>
      </div>

      {(lead.chiefComplaint || lead.city || lead.gender || lead.age) && (
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Card><div className="text-xs text-slate-500">Complaint</div><div className="font-medium">{lead.chiefComplaint ?? "—"}</div></Card>
          <Card><div className="text-xs text-slate-500">Disease</div><div className="font-medium">{lead.disease?.name ?? "—"}</div></Card>
          <Card><div className="text-xs text-slate-500">Demographics</div><div className="font-medium capitalize">{[lead.gender, lead.age ? `${lead.age}y` : null].filter(Boolean).join(" · ") || "—"}</div></Card>
          <Card><div className="text-xs text-slate-500">Location</div><div className="font-medium">{[lead.city, lead.district].filter(Boolean).join(", ") || "—"}</div></Card>
        </div>
      )}

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

      {canEdit && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">Transfer / reassign</h2>
            <form action={transferLead.bind(null, id)} className="space-y-2">
              <label className="block text-xs text-slate-500">Owner
                <select name="ownerId" defaultValue={lead.ownerId ?? ""} className={input}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="block text-xs text-slate-500">Branch (optional)
                <select name="branchId" defaultValue={lead.branchId ?? ""} className={input}>
                  <option value="">— keep —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <input name="reason" placeholder="Reason (optional)" className={input} />
              <SubmitButton>Transfer</SubmitButton>
            </form>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Merge duplicate</h2>
            <form action={mergeLead.bind(null, id)} className="flex items-center gap-2">
              <input name="targetId" placeholder="Surviving lead ID" className={input} />
              <SubmitButton tone="ghost">Merge into</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-slate-400">This lead&apos;s calls move to the target; this one is hidden as merged.</p>
          </Card>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Assignment history ({assignments.length})</h2>
          <div className="space-y-1 text-sm">
            {assignments.map((a) => {
              const name = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name ?? id : "Unassigned");
              return (
                <div key={a.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-slate-700 dark:text-slate-200">{name(a.fromOwnerId)} → <span className="font-medium">{name(a.toOwnerId)}</span>{a.reason ? <span className="text-slate-400"> · {a.reason}</span> : null}</span>
                  <span className="text-xs text-slate-400">{(a.createdAt as Date).toISOString().slice(0, 10)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Activity timeline ({events.length})</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-5 dark:border-slate-700">
            {events.map((e, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full ${TONE[e.kind] ?? "bg-slate-400"}`} aria-hidden />
                <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">{e.kind.replace(/_/g, " ")}</span>
                    <span className="text-slate-700 dark:text-slate-200">{e.text}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{e.at.toISOString().slice(0, 16).replace("T", " ")}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
