import { MODULE_DASHBOARDS } from "@/lib/modules/registry";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, conversionRate, branchScopeWhere, type DrillEntity, type DrillFilters, type RoleName } from "@prm/core";
import { DrillStat } from "@/components/drill/DrillStat";
import { DrillCount } from "@/components/drill/DrillCount";
import { ModuleLauncherCard } from "@/components/modules/ModuleLauncherCard";
import { drillCount } from "@/lib/drill/count";

async function ManagementKpis({ role, branchId }: { role: RoleName; branchId: string | null }) {
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

async function ModuleGrid({ role, branchId }: { role: RoleName; branchId: string | null }) {
  // Only modules the user can view; compute each module's headline KPI in parallel.
  const visible = MODULE_DASHBOARDS.filter((m) => can(role, m.resource, "view"));
  const values = await Promise.all(
    visible.map((m) => (m.headline ? drillCount(m.headline.entity, m.headline.filters, role, branchId) : Promise.resolve(null))),
  );
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Modules</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m, i) => <ModuleLauncherCard key={m.id} def={m} value={values[i]} />)}
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
          <div key={a.id} className="flex justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
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
          A master dashboard across all modules — open any module for its own dashboard and workspaces.
        </p>
      </header>

      {can(user.role, "dashboards", "view") && <ManagementKpis role={user.role} branchId={user.branchId} />}
      {user.role === "doctor" && <DoctorToday />}
      <ModuleGrid role={user.role} branchId={user.branchId} />
    </main>
  );
}
