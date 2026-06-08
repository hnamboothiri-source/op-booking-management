import Link from "next/link";
import { MODULES, PHASES, type BuildStatus } from "@/lib/blueprint";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, conversionRate, branchScopeWhere, type DrillEntity, type DrillFilters } from "@prm/core";
import { DrillStat } from "@/components/drill/DrillStat";

const STATUS_STYLE: Record<BuildStatus, string> = {
  done: "bg-green-100 text-green-800",
  in_progress: "bg-amber-100 text-amber-800",
  planned: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<BuildStatus, string> = { done: "Done", in_progress: "In progress", planned: "Planned" };

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

async function DoctorToday() {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const appts = await prisma.opBooking.findMany({
    where: { appointmentDate: today, status: { in: ["booked", "confirmed", "arrived", "waiting", "in_consultation"] } },
    include: { patient: true, doctor: true },
    orderBy: { startTime: "asc" },
    take: 50,
  });
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">Today&apos;s clinic ({appts.length})</h2>
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
        <p className="text-sm font-medium text-emerald-700">Welcome, {user.name} · {user.role.replace(/_/g, " ")}</p>
        <h1 className="text-3xl font-bold tracking-tight">Patient Relationship Management</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Lead → Appointment → Consultation → Referral/Test → Treatment/Admission → Follow-up → Retention → Referral → Lifetime relationship.
        </p>
      </header>

      {can(user.role, "dashboards", "view") && <ManagementKpis role={user.role} branchId={user.branchId} />}
      {user.role === "doctor" && <DoctorToday />}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Roadmap</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PHASES.map((p) => (
            <div key={p.n} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-emerald-700">Phase {p.n}</div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-slate-500">{p.duration}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Modules ({MODULES.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{m.id} · Phase {m.phase}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
              </div>
              <h3 className="mt-1 font-semibold">{m.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{m.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
