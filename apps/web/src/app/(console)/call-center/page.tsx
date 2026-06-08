import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, nextBookingStatuses, overdueAgeDays, overdueBucket, escalationLevel, ESCALATION_LABEL, type BookingStatus, type OverdueBucket } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { logCall, escalateLead, updateLeadStage } from "@/lib/leads/actions";
import { transitionFollowUp } from "@/lib/followups/actions";
import { transitionBooking } from "@/lib/appointments/actions";
import { executiveFunnel, allExecutiveFunnels } from "@/lib/callcenter/metrics";

export const dynamic = "force-dynamic";

const CALL_OUTCOMES = ["appointment_booked", "follow_up_required", "not_reachable", "call_later", "asked_for_doctor_details", "asked_for_treatment_cost", "interested_in_branch_visit", "interested_in_admission", "not_interested"];
const MANAGER_ROLES = ["administrator", "management", "call_center_manager"];
const TABS: { key: string; label: string }[] = [
  { key: "new", label: "New Leads" },
  { key: "pending", label: "Pending Calls" },
  { key: "today", label: "Today's Follow-ups" },
  { key: "overdue", label: "Overdue" },
  { key: "appointments", label: "Appointments" },
  { key: "performance", label: "My Performance" },
];
const BUCKET_TONE: Record<OverdueBucket, "amber" | "red"> = { "1d": "amber", "2-3d": "amber", "4-6d": "red", "7d+": "red" };
const cell = "px-4 py-2";
const tinyBtn = "rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";
const tinySelect = "rounded border border-slate-300 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default async function CallCenter({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireCan("leads", "view");
  const tab = (await searchParams).tab ?? "new";
  const scope = branchScopeWhere(user.role, user.branchId);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const workable = ["contacted", "interested", "not_reachable", "appointment_suggested"];

  // KPI tiles (always).
  const [newLeads, pendingCallbacks, dueToday, overdueCount, bookedToday, missedToday, unassigned, assignedToMe] = await Promise.all([
    prisma.lead.count({ where: { ...scope, stage: "new_lead" } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.lead.count({ where: { ...scope, followUpDate: { lte: today }, stage: { in: workable as any } } }),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] }, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] }, dueDate: { lt: today } } }),
    prisma.opBooking.count({ where: { ...scope, bookedAt: { gte: today } } }),
    prisma.callLog.count({ where: { outcome: "not_reachable", createdAt: { gte: today } } }),
    prisma.lead.count({ where: { ...scope, ownerId: null, stage: { notIn: ["converted_to_patient", "lost", "not_interested"] } } }),
    prisma.lead.count({ where: { ...scope, ownerId: user.id, stage: { notIn: ["converted_to_patient", "lost", "not_interested"] } } }),
  ]);
  const lostReasons = await prisma.reasonMaster.findMany({ where: { category: "lost_lead" } });

  return (
    <div>
      <PageHeader title="Call Center" subtitle="Lead → Call → Outcome → Task / Appointment / Closure (Module 2)" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <DrillStat label="New leads" value={newLeads} entity="leads" filters={{ stage: "new_lead" }} />
        <DrillStat label="Unassigned" value={unassigned} entity="leads" filters={{ unassigned: "true" }} />
        <DrillStat label="Assigned to me" value={assignedToMe} entity="leads" filters={{ ownerId: user.id }} />
        <DrillStat label="Pending calls" value={pendingCallbacks} entity="leads" filters={{ callback: "pending" }} />
        <DrillStat label="Due today" value={dueToday} entity="followups" filters={{ due: "today" }} />
        <DrillStat label="Overdue" value={overdueCount} entity="followups" filters={{ due: "overdue" }} />
        <DrillStat label="Missed today" value={missedToday} entity="calls" filters={{ outcome: "not_reachable", when: "today" }} />
        <DrillStat label="Booked today" value={bookedToday} entity="appointments" filters={{ bookedOn: "today" }} />
      </div>

      {/* Tab bar */}
      <div className="mb-5 mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2 text-sm dark:border-slate-700">
        {TABS.map((t) => (
          <Link key={t.key} href={`/call-center?tab=${t.key}`} className={`rounded-full px-3 py-1 ${tab === t.key ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {(tab === "new" || tab === "pending") && <LeadQueue scope={scope} pending={tab === "pending"} workable={workable} today={today} lostReasons={lostReasons} />}
      {(tab === "today" || tab === "overdue") && <FollowUpQueue overdue={tab === "overdue"} today={today} tomorrow={tomorrow} />}
      {tab === "appointments" && <AppointmentQueue scope={scope} today={today} />}
      {tab === "performance" && <Performance userId={user.id} userName={user.name} isManager={MANAGER_ROLES.includes(user.role)} />}
    </div>
  );

  // --- Lead queue (New / Pending) ---
  async function LeadQueue({ scope, pending, workable, today, lostReasons }: { scope: { branchId?: string }; pending: boolean; workable: string[]; today: Date; lostReasons: { id: string; label: string }[] }) {
    const where = pending
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? { ...scope, followUpDate: { lte: today }, stage: { in: workable as any } }
      : { ...scope, stage: "new_lead" as const };
    const leads = await prisma.lead.findMany({ where, include: { owner: true, source: true }, orderBy: { createdAt: "desc" }, take: 100 });

    return (
      <Queue title={pending ? "Pending calls" : "New leads"} count={leads.length} cols={["Name", "Phone", "Source", "Owner", "Actions"]}>
        {leads.map((l) => (
          <tr key={l.id} className="border-t border-slate-100 align-middle dark:border-slate-700">
            <td className={cell}><Link href={`/leads/${l.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{l.contactName}</Link></td>
            <td className={`${cell} text-slate-600 dark:text-slate-300`}>{l.phone}</td>
            <td className={`${cell} text-slate-600 dark:text-slate-300`}>{l.source?.name?.replace(/_/g, " ") ?? "—"}</td>
            <td className={`${cell} text-slate-600 dark:text-slate-300`}>{l.owner?.name ?? <span className="text-amber-600">unassigned</span>}</td>
            <td className={cell}>
              <div className="flex flex-wrap items-center gap-1.5">
                <form action={logCall.bind(null, l.id)} className="flex items-center gap-1">
                  <select name="outcome" className={tinySelect} defaultValue="follow_up_required">{CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>
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
              </div>
            </td>
          </tr>
        ))}
      </Queue>
    );
  }

  // --- Follow-up queue (Today / Overdue) ---
  async function FollowUpQueue({ overdue, today, tomorrow }: { overdue: boolean; today: Date; tomorrow: Date }) {
    const dueDate = overdue ? { lt: today } : { gte: today, lt: tomorrow };
    const rows = await prisma.followUp.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { status: { in: ["pending", "booked"] as any }, dueDate },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
      take: 200,
    });
    const now = new Date();

    return (
      <Queue title={overdue ? "Overdue follow-ups" : "Follow-ups due today"} count={rows.length} cols={overdue ? ["Patient", "Type", "Due", "Ageing", "Escalation", "Actions"] : ["Patient", "Type", "Due", "Actions"]}>
        {rows.map((f) => {
          const age = overdueAgeDays(f.dueDate, now);
          const lvl = escalationLevel(age);
          return (
            <tr key={f.id} className="border-t border-slate-100 align-middle dark:border-slate-700">
              <td className={cell}><Link href={`/patients/${encodeURIComponent(f.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{f.patient?.name ?? f.patientMrd}</Link></td>
              <td className={`${cell} text-slate-600 dark:text-slate-300`}>{f.type.replace(/_/g, " ")}</td>
              <td className={`${cell} text-slate-600 dark:text-slate-300`}>{f.dueDate.toISOString().slice(0, 10)}</td>
              {overdue && <td className={cell}><Badge tone={BUCKET_TONE[overdueBucket(age)]}>{overdueBucket(age)}</Badge></td>}
              {overdue && <td className={`${cell} text-xs text-slate-500 dark:text-slate-400`}>{ESCALATION_LABEL[lvl]}</td>}
              <td className={cell}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/appointments/book?mrd=${encodeURIComponent(f.patientMrd)}`} className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700">Book</Link>
                  <form action={transitionFollowUp.bind(null, f.id, "done")}><button className={tinyBtn}>Done</button></form>
                  <form action={transitionFollowUp.bind(null, f.id, "missed")}><button className={tinyBtn}>{overdue ? "Escalate" : "Missed"}</button></form>
                </div>
              </td>
            </tr>
          );
        })}
      </Queue>
    );
  }

  // --- Appointments booked today ---
  async function AppointmentQueue({ scope, today }: { scope: Record<string, unknown>; today: Date }) {
    const rows = await prisma.opBooking.findMany({ where: { ...scope, bookedAt: { gte: today } }, include: { patient: true, doctor: true }, orderBy: { startTime: "asc" }, take: 100 });
    return (
      <Queue title="Booked today" count={rows.length} cols={["Time", "Patient", "Doctor", "Status", "Actions"]}>
        {rows.map((b) => (
          <tr key={b.id} className="border-t border-slate-100 align-middle dark:border-slate-700">
            <td className={`${cell} font-medium`}>{b.startTime}</td>
            <td className={cell}><Link href={`/patients/${encodeURIComponent(b.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{b.patient.name}</Link></td>
            <td className={`${cell} text-slate-600 dark:text-slate-300`}>{b.doctor.name}</td>
            <td className={cell}><Badge tone="blue">{b.status.replace(/_/g, " ")}</Badge></td>
            <td className={cell}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/appointments/${b.id}`} className={tinyBtn}>Open</Link>
                <Link href={`/appointments/book?rescheduleFrom=${b.id}`} className={tinyBtn}>Reschedule</Link>
                {nextBookingStatuses(b.status as BookingStatus).slice(0, 2).map((s) => (
                  <form key={s} action={transitionBooking.bind(null, b.id, s)}><button className={tinyBtn}>{s.replace(/_/g, " ")}</button></form>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </Queue>
    );
  }

  // --- My Performance (executive funnel) ---
  async function Performance({ userId, userName, isManager }: { userId: string; userName: string; isManager: boolean }) {
    const mine = await executiveFunnel(userId, userName);
    const all = isManager ? await allExecutiveFunnels() : [];
    const stat = (label: string, value: React.ReactNode) => (
      <Card><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</div></Card>
    );
    return (
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">My funnel</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stat("Leads", mine.leads)}
          {stat("Calls", mine.calls)}
          {stat("Appointments", mine.appointments)}
          {stat("Arrivals", mine.arrivals)}
          {stat("Conversion", `${mine.conversion}%`)}
          {stat("Follow-ups done", mine.followUpsDone)}
        </div>
        {isManager && (
          <>
            <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">All executives</h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className={cell}>Executive</th><th className={cell}>Leads</th><th className={cell}>Calls</th><th className={cell}>Appts</th><th className={cell}>Arrivals</th><th className={cell}>Conversion</th></tr></thead>
                <tbody>
                  {all.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No data.</td></tr>}
                  {all.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className={cell}>{e.name}</td><td className={cell}>{e.leads}</td><td className={cell}>{e.calls}</td><td className={cell}>{e.appointments}</td><td className={cell}>{e.arrivals}</td>
                      <td className={cell}><Badge tone={e.conversion >= 30 ? "green" : "amber"}>{e.conversion}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }
}

function Queue({ title, count, cols, children }: { title: string; count: number; cols: string[]; children: React.ReactNode }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title} ({count})</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{cols.map((c) => <th key={c} className={cell}>{c}</th>)}</tr></thead>
          <tbody>
            {empty && <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-slate-400">Nothing here.</td></tr>}
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}
