import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createFollowUp, transitionFollowUp } from "@/lib/followups/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { DrillStat } from "@/components/drill/DrillStat";
import { PlanActivitySelect } from "@/components/planning/PlanActivitySelect";

export const dynamic = "force-dynamic";

const FU_TYPES = ["consultation_review", "medicine", "therapy", "test", "admission", "surgery_procedure", "long_term_treatment", "annual_checkup", "dormant_reactivation"];
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

function Row({ f, canEdit }: { f: { id: string; type: string; dueDate: Date; status: string; patientMrd: string; patient: { name: string } }; canEdit: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
      <span>
        <Link href={`/patients/${encodeURIComponent(f.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{f.patient.name}</Link>
        {" · "}{f.type.replace(/_/g, " ")} · due {f.dueDate.toISOString().slice(0, 10)}
      </span>
      <div className="flex items-center gap-2">
        <Badge tone={f.status === "done" ? "green" : f.status === "missed" ? "red" : "blue"}>{f.status}</Badge>
        <LinkButton href={`/follow-ups/${f.id}`} tone="ghost">Open</LinkButton>
        {canEdit && f.status !== "done" && (
          <>
            <LinkButton href={`/appointments/book?mrd=${encodeURIComponent(f.patientMrd)}`} tone="ghost">Book</LinkButton>
            <form action={transitionFollowUp.bind(null, f.id, "done")}><button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Done</button></form>
            <form action={transitionFollowUp.bind(null, f.id, "missed")}><button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Missed</button></form>
          </>
        )}
      </div>
    </div>
  );
}

export default async function FollowUps({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("follow_ups", "view");
  const canEdit = can(user.role, "follow_ups", "edit");
  const today = new Date(new Date().toISOString().slice(0, 10));
  const filters = listFilters("followups", await searchParams);
  const filtered = Object.keys(filters).length > 0;

  // Default view = the open worklist grouped by urgency. A drill-down filter
  // (e.g. status, type) switches to a flat filtered list.
  const open = await prisma.followUp.findMany({
    where: filtered ? DRILL.followups.buildWhere(filters) : { status: { in: ["pending", "booked"] } },
    include: { patient: true },
    orderBy: { dueDate: "asc" },
    take: 300,
  });
  const overdue = open.filter((f) => f.dueDate < today);
  const dueToday = open.filter((f) => f.dueDate.getTime() === today.getTime());
  const upcoming = open.filter((f) => f.dueDate > today);

  const [doctors, staff, reviewOpen, medsOpen, missedCount] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.followUp.count({ where: { type: "consultation_review", status: { in: ["pending", "booked"] } } }),
    prisma.followUp.count({ where: { type: "medicine", status: { in: ["pending", "booked"] } } }),
    prisma.followUp.count({ where: { status: "missed" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Make sure patients don't drop out (Module 9)"
        action={<div className="flex gap-2"><LinkButton href={`/follow-ups?ownerId=${user.id}`} tone="ghost">My worklist</LinkButton><LinkButton href="/follow-ups/escalations" tone="ghost">Escalations</LinkButton><LinkButton href="/follow-ups/reports" tone="ghost">Reports</LinkButton></div>}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <DrillStat label="Review appointments" value={reviewOpen} entity="followups" filters={{ type: "consultation_review" }} sub="Open consultation reviews" />
        <DrillStat label="Medication follow-up" value={medsOpen} entity="followups" filters={{ type: "medicine" }} sub="Open medicine reviews" />
        <DrillStat label="Missed follow-up alerts" value={missedCount} entity="followups" filters={{ status: "missed" }} sub="Escalated to manager" />
      </div>

      {can(user.role, "follow_ups", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New follow-up</h2>
          <form action={createFollowUp} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <input name="patientMrd" placeholder="Patient MRD" required className={input} />
            <select name="type" className={input}>{FU_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
            <input type="date" name="dueDate" required className={input} />
            <select name="ownerId" className={input}><option value="">Owner: me</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <input name="notes" placeholder="Instructions / notes" className={`${input} sm:col-span-1`} />
            <div className="sm:col-span-2"><PlanActivitySelect slug="follow-ups" typeKey="followup_drive" /></div>
            <SubmitButton>Add</SubmitButton>
          </form>
        </Card>
      )}

      <div className="mt-6"><ActiveFilters filters={filters} basePath="/follow-ups" /></div>

      {filtered ? (
        <div className="space-y-1">
          {open.length === 0 ? <p className="text-sm text-slate-400">No matching follow-ups.</p> : open.map((f) => <Row key={f.id} f={f} canEdit={canEdit} />)}
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">Overdue ({overdue.length})</h2>
            <div className="space-y-1">{overdue.length === 0 ? <p className="text-sm text-slate-400">None.</p> : overdue.map((f) => <Row key={f.id} f={f} canEdit={canEdit} />)}</div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-600">Due today ({dueToday.length})</h2>
            <div className="space-y-1">{dueToday.length === 0 ? <p className="text-sm text-slate-400">None.</p> : dueToday.map((f) => <Row key={f.id} f={f} canEdit={canEdit} />)}</div>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming ({upcoming.length})</h2>
            <div className="space-y-1">{upcoming.length === 0 ? <p className="text-sm text-slate-400">None.</p> : upcoming.slice(0, 50).map((f) => <Row key={f.id} f={f} canEdit={canEdit} />)}</div>
          </section>
        </div>
      )}
    </div>
  );
}
