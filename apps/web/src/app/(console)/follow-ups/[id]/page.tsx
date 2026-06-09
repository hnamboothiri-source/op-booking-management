import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionFollowUp, recordFollowUpOutcome, rescheduleFollowUp, closeFollowUp } from "@/lib/followups/actions";
import { can, checklistCompletion, safeParseChecklist, FOLLOWUP_OUTCOMES, AYURVEDA_OUTCOMES, FOLLOWUP_OUTCOME_LABELS, FOLLOWUP_CONTACT_MODES, FOLLOWUP_CLOSURE_REASONS, outcomeTone, type FollowUpOutcome } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800";
const lab = "text-xs font-medium text-slate-600 dark:text-slate-300";
const GENERAL_OUTCOMES = FOLLOWUP_OUTCOMES.filter((o) => !AYURVEDA_OUTCOMES.includes(o));

export default async function FollowUpDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("follow_ups", "view");
  const f = await prisma.followUp.findUnique({ where: { id }, include: { patient: true, doctor: true } });
  if (!f) notFound();
  const canEdit = can(user.role, "follow_ups", "edit");
  const canCall = can(user.role, "calls", "create");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (await prisma.callLog.findMany({ where: { followUpId: id } as any, orderBy: { createdAt: "desc" } }).catch(() => [])) as { id: string; outcome: string; notes: string | null; checklistJson?: string | null; createdAt: Date }[];
  // Activity log + escalations (mock include is a no-op → query separately).
  const [activities, escalations] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.followUpActivity.findMany({ where: { followUpId: id } as any, orderBy: { contactDate: "desc" } }).catch(() => [] as Record<string, unknown>[]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.followUpEscalation.findMany({ where: { followUpId: id } as any, orderBy: { createdAt: "desc" } }).catch(() => [] as Record<string, unknown>[]),
  ]);

  return (
    <div>
      <PageHeader title="Follow-up" subtitle={`${f.patient?.name ?? f.patientMrd} · ${f.type.replace(/_/g, " ")}`} action={<Badge tone={f.status === "done" ? "green" : f.status === "missed" ? "red" : "blue"}>{f.status}</Badge>} />
      <div className="mb-6"><Link href="/follow-ups" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Follow-ups</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Patient</div><div className="font-medium"><Link href={`/patients/${encodeURIComponent(f.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{f.patient?.name ?? f.patientMrd}</Link></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Type</div><div className="font-medium">{f.type.replace(/_/g, " ")}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Due</div><div className="font-medium">{f.dueDate.toISOString().slice(0, 10)}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Doctor</div><div className="font-medium">{f.doctor?.name ?? "—"}</div></Card>
      </div>

      {canEdit && f.status !== "done" && (
        <div className="flex flex-wrap items-center gap-2">
          {canCall && <LinkButton href={`/follow-ups/${f.id}/call`}>Open review call ☑</LinkButton>}
          <LinkButton href={`/appointments/book?mrd=${encodeURIComponent(f.patientMrd)}`} tone="ghost">Book appointment</LinkButton>
          <form action={transitionFollowUp.bind(null, f.id, "done")}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark done</button></form>
          <form action={transitionFollowUp.bind(null, f.id, "missed")}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark missed</button></form>
        </div>
      )}

      {canEdit && f.status !== "done" && f.status !== "cancelled" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {/* Outcome entry */}
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Record outcome</h3>
            <form action={recordFollowUpOutcome.bind(null, f.id)} className="space-y-2">
              <label className={`${lab} block`}>Contact mode<select name="contactMode" className={input}>{FOLLOWUP_CONTACT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
              <label className={`${lab} block`}>Outcome
                <select name="outcome" className={input}>
                  <optgroup label="General">{GENERAL_OUTCOMES.map((o) => <option key={o} value={o}>{FOLLOWUP_OUTCOME_LABELS[o]}</option>)}</optgroup>
                  <optgroup label="Ayurveda">{AYURVEDA_OUTCOMES.map((o) => <option key={o} value={o}>{FOLLOWUP_OUTCOME_LABELS[o]}</option>)}</optgroup>
                </select>
              </label>
              <label className={`${lab} block`}>Remarks<input name="remarks" className={input} /></label>
              <label className={`${lab} block`}>Next action<input name="nextAction" placeholder="e.g. book therapy" className={input} /></label>
              <label className={`${lab} block`}>Next follow-up date<input type="date" name="nextFollowUpDate" className={input} /></label>
              <SubmitButton>Save outcome</SubmitButton>
            </form>
          </Card>
          {/* Reschedule */}
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Reschedule</h3>
            <form action={rescheduleFollowUp.bind(null, f.id)} className="space-y-2">
              <label className={`${lab} block`}>New due date<input type="date" name="dueDate" required className={input} /></label>
              <label className={`${lab} block`}>Reason<input name="reason" placeholder="patient travelling…" className={input} /></label>
              <SubmitButton tone="ghost">Reschedule</SubmitButton>
            </form>
          </Card>
          {/* Close */}
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Close follow-up</h3>
            <form action={closeFollowUp.bind(null, f.id)} className="space-y-2">
              <label className={`${lab} block`}>Closure reason<select name="closureReason" className={input}>{FOLLOWUP_CLOSURE_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</select></label>
              <SubmitButton tone="danger">Close</SubmitButton>
            </form>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Follow-up activity</h2>
        {activities.length === 0 && escalations.length === 0 ? (
          <p className="text-sm text-slate-400">No contact attempts recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {escalations.map((e) => (
              <div key={`esc-${e.id}`} className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                <span><Badge tone="amber">escalated L{e.level as number}</Badge> <span className="ml-2 text-amber-800 dark:text-amber-200">{(e.reason as string) ?? ""}</span></span>
                <span className="text-xs text-slate-400">{new Date(e.createdAt as Date).toISOString().slice(0, 10)}</span>
              </div>
            ))}
            {activities.map((a) => (
              <div key={a.id as string} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <span>
                  <Badge tone={outcomeTone(a.outcome as FollowUpOutcome)}>{FOLLOWUP_OUTCOME_LABELS[a.outcome as FollowUpOutcome]}</Badge>
                  <span className="ml-2 text-xs text-slate-400">{String(a.contactMode)}</span>
                  {a.remarks ? <span className="ml-2 text-slate-600 dark:text-slate-300">{a.remarks as string}</span> : null}
                  {a.nextAction ? <span className="ml-2 text-xs text-rose-600">→ {a.nextAction as string}</span> : null}
                </span>
                <span className="text-xs text-slate-400">{new Date(a.contactDate as Date).toISOString().slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Calls &amp; checklist</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-slate-400">No review calls logged yet.</p>
        ) : (
          <div className="space-y-2">
            {calls.map((c) => {
              const cl = checklistCompletion(safeParseChecklist(c.checklistJson));
              const answered = safeParseChecklist(c.checklistJson);
              return (
                <Card key={c.id}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium capitalize">{c.outcome.replace(/_/g, " ")}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {cl.total > 0 && <Badge tone={cl.done === cl.total ? "green" : "amber"}>checklist {cl.done}/{cl.total}</Badge>}
                      <span>{new Date(c.createdAt).toISOString().slice(0, 10)}</span>
                    </div>
                  </div>
                  {c.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{c.notes}</p>}
                  {answered.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {answered.map((a, i) => (
                        <li key={i}>{a.checked || (a.value && a.value.trim()) ? "✓" : "○"} {a.label}{a.value ? `: ${a.value}` : ""}{a.note ? ` — ${a.note}` : ""}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
