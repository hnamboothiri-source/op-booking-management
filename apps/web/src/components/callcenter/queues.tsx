/**
 * Shared call-centre queue components used by the desk pages (Reception /
 * Front Office / Back Office) and the overview. Server components with inline
 * action forms that reuse the existing server actions, so rows act in place.
 */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { overdueAgeDays, overdueBucket, escalationLevel, ESCALATION_LABEL, deskLabel, CALL_DESKS, type OverdueBucket, type CallDesk } from "@prm/core";
import { Badge } from "@/components/ui";
import { LeadTierBadge } from "@/components/leads/TierBadge";
import { logCall, escalateLead, updateLeadStage, routeLeadToDesk } from "@/lib/leads/actions";
import { transitionFollowUp, routeFollowUpToDesk } from "@/lib/followups/actions";

const CALL_OUTCOMES = ["appointment_booked", "follow_up_required", "not_reachable", "call_later", "asked_for_doctor_details", "asked_for_treatment_cost", "interested_in_branch_visit", "interested_in_admission", "not_interested"];
const BUCKET_TONE: Record<OverdueBucket, "amber" | "red"> = { "1d": "amber", "2-3d": "amber", "4-6d": "red", "7d+": "red" };
const cell = "px-4 py-2";
const tinyBtn = "rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";
const tinySelect = "rounded border border-slate-300 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function Queue({ title, count, cols, children }: { title: string; count: number; cols: string[]; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title} ({count})</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{cols.map((c) => <th key={c} className={cell}>{c}</th>)}</tr></thead>
          <tbody>
            {count === 0 && <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-slate-400">Nothing here.</td></tr>}
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Buttons that re-route a record to each *other* desk. */
function RouteToDesk({ current, action }: { current: string | null | undefined; action: (desk: CallDesk) => Promise<void> }) {
  return (
    <>
      {CALL_DESKS.filter((d) => d.key !== current).map((d) => (
        <form key={d.key} action={action.bind(null, d.key)}><button className={tinyBtn} title={`Move to ${d.label}`}>→ {d.label.split(" ")[0]}</button></form>
      ))}
    </>
  );
}

export async function LeadQueue({ where, title }: { where: Record<string, unknown>; title: string }) {
  const [leads, lostReasons] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.lead.findMany({ where: where as any, include: { owner: true, source: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.reasonMaster.findMany({ where: { category: "lost_lead" } }),
  ]);
  const now = new Date();
  return (
    <Queue title={title} count={leads.length} cols={["Name", "Phone", "Priority / SLA", "Source", "Owner", "Actions"]}>
      {leads.map((l) => (
        <tr key={l.id} className="border-t border-slate-100 align-middle dark:border-slate-700">
          <td className={cell}><Link href={`/leads/${l.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{l.contactName}</Link></td>
          <td className={`${cell} text-slate-600 dark:text-slate-300`}>{l.phone}</td>
          <td className={cell}><LeadTierBadge lead={l} now={now} /></td>
          <td className={`${cell} text-slate-600 dark:text-slate-300`}>{l.source?.name?.replace(/_/g, " ") ?? "—"}</td>
          <td className={`${cell} text-slate-600 dark:text-slate-300`}>{l.owner?.name ?? <span className="text-amber-600">unassigned</span>}</td>
          <td className={cell}>
            <div className="flex flex-wrap items-center gap-1.5">
              <form action={logCall.bind(null, l.id)} className="flex items-center gap-1">
                <select name="outcome" defaultValue="follow_up_required" className={tinySelect}>{CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>
                <button className={tinyBtn}>Log call</button>
              </form>
              <form action={logCall.bind(null, l.id)}><input type="hidden" name="outcome" value="not_reachable" /><button className={tinyBtn}>Not reachable</button></form>
              <Link href={`/appointments/book?leadId=${l.id}`} className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">Book</Link>
              <form action={escalateLead.bind(null, l.id)}><button className={tinyBtn}>Escalate</button></form>
              <form action={updateLeadStage.bind(null, l.id)} className="flex items-center gap-1">
                <input type="hidden" name="stage" value="lost" />
                <select name="closureReason" required className={tinySelect}><option value="">close…</option>{lostReasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}</select>
                <button className={tinyBtn}>Close</button>
              </form>
              <RouteToDesk current={l.desk} action={routeLeadToDesk.bind(null, l.id)} />
            </div>
          </td>
        </tr>
      ))}
    </Queue>
  );
}

export async function FollowUpQueue({ where, overdue, title }: { where: Record<string, unknown>; overdue: boolean; title: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await prisma.followUp.findMany({ where: where as any, include: { patient: true }, orderBy: { dueDate: "asc" }, take: 200 });
  const now = new Date();
  const cols = overdue ? ["Patient", "Type", "Due", "Ageing", "Escalation", "Actions"] : ["Patient", "Type", "Due", "Actions"];
  return (
    <Queue title={title} count={rows.length} cols={cols}>
      {rows.map((f) => {
        const age = overdueAgeDays(f.dueDate, now);
        return (
          <tr key={f.id} className="border-t border-slate-100 align-middle dark:border-slate-700">
            <td className={cell}><Link href={`/patients/${encodeURIComponent(f.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{f.patient?.name ?? f.patientMrd}</Link></td>
            <td className={`${cell} text-slate-600 dark:text-slate-300`}>{f.type.replace(/_/g, " ")}</td>
            <td className={`${cell} text-slate-600 dark:text-slate-300`}>{f.dueDate.toISOString().slice(0, 10)}</td>
            {overdue && <td className={cell}><Badge tone={BUCKET_TONE[overdueBucket(age)]}>{overdueBucket(age)}</Badge></td>}
            {overdue && <td className={`${cell} text-xs text-slate-500 dark:text-slate-400`}>{ESCALATION_LABEL[escalationLevel(age)]}</td>}
            <td className={cell}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/appointments/book?mrd=${encodeURIComponent(f.patientMrd)}`} className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">Book</Link>
                <form action={transitionFollowUp.bind(null, f.id, "done")}><button className={tinyBtn}>Done</button></form>
                <form action={transitionFollowUp.bind(null, f.id, "missed")}><button className={tinyBtn}>{overdue ? "Escalate" : "Missed"}</button></form>
                <RouteToDesk current={f.desk} action={routeFollowUpToDesk.bind(null, f.id)} />
              </div>
            </td>
          </tr>
        );
      })}
    </Queue>
  );
}

export { deskLabel };
