import Link from "next/link";
import { MODULES, PHASES } from "@/lib/blueprint";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, conversionRate, funnelRate, branchScopeWhere, type DrillEntity, type DrillFilters } from "@prm/core";
import { DrillStat } from "@/components/drill/DrillStat";
import { DrillCount } from "@/components/drill/DrillCount";
import { Card } from "@/components/ui";
import { ModuleCard } from "@/components/ModuleCard";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { leadFunnel } from "@/lib/leads/funnel";
import { BarChartCard } from "@/components/charts/BarChartCard";

async function ManagementKpis({ role, branchId }: { role: Parameters<typeof branchScopeWhere>[0]; branchId: string | null }) {
  const scope = branchScopeWhere(role, branchId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  const [totalLeads, converted, apptToday, completed, admissionsRec, pendingFu, dormant] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, stage: { in: ["appointment_booked", "converted_to_patient"] } } }),
    prisma.opBooking.count({ where: { ...scope, appointmentDate: today } }),
    prisma.opBooking.count({ where: { ...scope, status: "completed" } }),
    prisma.admissionRecommendation.count(),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] } } }),
    prisma.patient.count({ where: { category: "dormant" } }),
  ]);
  const tiles: { label: string; value: React.ReactNode; entity: DrillEntity; filters: DrillFilters }[] = [
    { label: "Total leads", value: totalLeads, entity: "leads", filters: {} },
    { label: "Lead conversion", value: `${conversionRate(converted, totalLeads)}%`, entity: "leads", filters: { stage: "appointment_booked,converted_to_patient" } },
    { label: "Appointments today", value: apptToday, entity: "appointments", filters: { date: todayStr } },
    { label: "Consultations completed", value: completed, entity: "appointments", filters: { status: "completed" } },
    { label: "Admissions recommended", value: admissionsRec, entity: "admissions", filters: {} },
    { label: "Pending follow-ups", value: pendingFu, entity: "followups", filters: { status: "pending,booked" } },
    { label: "Dormant patients", value: dormant, entity: "patients", filters: { category: "dormant" } },
  ];
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">Management overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map((t) => (
          <DrillStat key={t.label} label={t.label} value={t.value} entity={t.entity} filters={t.filters} />
        ))}
      </div>
    </section>
  );
}

async function LeadFunnelSection({ role, branchId }: { role: Parameters<typeof branchScopeWhere>[0]; branchId: string | null }) {
  const stages = await leadFunnel(branchScopeWhere(role, branchId));
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">Lead conversion funnel</h2>
      <Card>
        <LeadFunnelChart stages={stages} />
        <p className="mt-2 text-xs text-slate-400">Click a stage to preview the records behind it.</p>
      </Card>
    </section>
  );
}

async function AppointmentsOverview({ role, branchId }: { role: Parameters<typeof branchScopeWhere>[0]; branchId: string | null }) {
  const scope = branchScopeWhere(role, branchId);
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayWhere = (status: string[]) => ({ ...scope, appointmentDate: today, status: { in: status } } as any);
  const [booked, arrived, waiting, completed, noShow, slots] = await Promise.all([
    prisma.opBooking.count({ where: dayWhere(["booked", "confirmed"]) }),
    prisma.opBooking.count({ where: dayWhere(["arrived"]) }),
    prisma.opBooking.count({ where: dayWhere(["waiting", "in_consultation"]) }),
    prisma.opBooking.count({ where: dayWhere(["completed"]) }),
    prisma.opBooking.count({ where: dayWhere(["no_show"]) }),
    prisma.timeSlot.findMany({ where: { slotDate: today }, select: { capacity: true, bookedCount: true } }),
  ]);
  const cap = slots.reduce((s, x) => s + (x.capacity ?? 0), 0);
  const bookedSlots = slots.reduce((s, x) => s + (x.bookedCount ?? 0), 0);
  const utilisation = funnelRate(bookedSlots, cap);
  const arrivedAll = arrived + waiting + completed;

  const tiles: { label: string; value: React.ReactNode; filters: DrillFilters }[] = [
    { label: "Booked", value: booked, filters: { date: todayStr, status: "booked,confirmed" } },
    { label: "Arrived", value: arrived, filters: { date: todayStr, status: "arrived" } },
    { label: "Waiting", value: waiting, filters: { date: todayStr, status: "waiting,in_consultation" } },
    { label: "Completed", value: completed, filters: { date: todayStr, status: "completed" } },
    { label: "No-show", value: noShow, filters: { date: todayStr, status: "no_show" } },
  ];

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Appointments today</h2>
        <Link href="/reports/appointments" className="text-sm text-rose-700 hover:underline dark:text-rose-300">Full appointment report →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => <DrillStat key={t.label} label={t.label} value={t.value} entity="appointments" filters={t.filters} />)}
        <DrillStat label="Slot utilisation" value={`${utilisation}%`} entity="appointments" filters={{ date: todayStr }} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card><div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Today&apos;s flow</div><BarChartCard data={[{ label: "Booked", value: booked + arrivedAll }, { label: "Arrived", value: arrivedAll }, { label: "Completed", value: completed }]} height={130} /></Card>
        <div className="flex flex-col justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <Link href="/appointments/calendar" className="text-rose-700 hover:underline dark:text-rose-300">📅 Doctor calendar →</Link>
          <Link href="/appointments/branches" className="text-rose-700 hover:underline dark:text-rose-300">🏥 Branch schedule dashboard →</Link>
          <Link href="/queue" className="text-rose-700 hover:underline dark:text-rose-300">🎫 Patient queue (tokens) →</Link>
        </div>
      </div>
    </section>
  );
}

async function DoctorToday() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);
  const worklist = "booked,confirmed,arrived,waiting,in_consultation";
  const appts = await prisma.opBooking.findMany({
    where: { appointmentDate: today, status: { in: ["booked", "confirmed", "arrived", "waiting", "in_consultation"] } },
    include: { patient: true, doctor: true },
    orderBy: { startTime: "asc" },
    take: 50,
  });
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">
        Today&apos;s clinic (<DrillCount value={appts.length} entity="appointments" filters={{ date: todayStr, status: worklist }} label="Today's clinic" />)
      </h2>
      <div className="space-y-1">
        {appts.length === 0 && <p className="text-sm text-slate-400">No appointments today.</p>}
        {appts.map((a) => (
          <div key={a.id} className="flex justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
            <span>{a.startTime} · {a.patient.name} · {a.doctor.name}</span><span className="text-slate-500">{a.status.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function Dashboard() {
  const user = await requireUser();
  return (
    <main>
      <header className="mb-8">
        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Welcome, {user.name} · {user.role.replace(/_/g, " ")}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Patient Relationship Management</h1>
        <p className="mt-2 max-w-3xl text-slate-500 dark:text-slate-400">
          Lead → Appointment → Consultation → Referral/Test → Treatment/Admission → Follow-up → Retention → Referral → Lifetime relationship.
        </p>
      </header>

      {can(user.role, "dashboards", "view") && <ManagementKpis role={user.role} branchId={user.branchId} />}
      {can(user.role, "dashboards", "view") && <LeadFunnelSection role={user.role} branchId={user.branchId} />}
      {can(user.role, "appointments", "view") && <AppointmentsOverview role={user.role} branchId={user.branchId} />}
      {user.role === "doctor" && <DoctorToday />}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Roadmap</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PHASES.map((p) => (
            <Card key={p.n}>
              <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">Phase {p.n}</div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{p.duration}</div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Modules ({MODULES.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => <ModuleCard key={m.id} module={m} />)}
        </div>
      </section>
    </main>
  );
}
