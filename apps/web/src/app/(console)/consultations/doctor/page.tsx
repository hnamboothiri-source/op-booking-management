import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";

export const dynamic = "force-dynamic";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const humanize = (s: string) => s.replace(/_/g, " ");

export default async function DoctorConsultationDashboard({ searchParams }: { searchParams: Promise<{ doctorId?: string }> }) {
  await requireCan("consultations", "view");
  const sp = await searchParams;
  const doctors = await prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const selected = doctors.find((d) => d.id === (sp.doctorId ?? "")) ?? doctors.find((d) => d.opDoctor) ?? doctors[0];
  const did = selected?.id;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const tomorrow = new Date(today.getTime() + 86400000);

  if (!did) return <div><PageHeader title="Doctor dashboard" /><Card><p className="text-sm text-slate-500">No doctors.</p></Card></div>;

  const [queue, recent, outcomeGroups, pendingFollowUps, openAdmissions, myConsultIds] = await Promise.all([
    prisma.opBooking.findMany({ where: { doctorId: did, appointmentDate: { gte: today, lt: tomorrow }, status: { in: ["arrived", "waiting", "in_consultation"] } }, include: { patient: true, department: true }, orderBy: { startTime: "asc" } }),
    prisma.consultation.findMany({ where: { doctorId: did }, include: { patient: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.consultation.groupBy({ by: ["outcome"], _count: { _all: true }, where: { doctorId: did } }),
    prisma.followUp.count({ where: { doctorId: did, status: { in: ["pending", "booked"] } } }),
    prisma.admissionRecommendation.count({ where: { doctorId: did, status: { in: ["recommended", "counselled", "interested"] } } }),
    prisma.consultation.findMany({ where: { doctorId: did }, select: { id: true } }),
  ]);
  const consultIds = myConsultIds.map((c) => c.id);
  const pendingLabs = consultIds.length ? await prisma.labReferral.count({ where: { consultationId: { in: consultIds }, status: "pending" } }) : 0;
  const totalConsults = outcomeGroups.reduce((a, g) => a + g._count._all, 0);

  return (
    <div>
      <PageHeader title="Doctor dashboard" subtitle={selected?.name} action={<LinkButton href="/consultations" tone="ghost">← Consultations</LinkButton>} />

      <form className="mb-4 flex items-end gap-2 text-sm">
        <label className="text-slate-500">Doctor
          <select name="doctorId" defaultValue={did} className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800">
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Go</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <DrillStat label="In queue now" value={queue.length} entity="appointments" filters={{ doctorId: did, date: iso(today), status: "arrived,waiting,in_consultation" }} />
        <DrillStat label="My consultations" value={totalConsults} entity="consultations" filters={{ doctorId: did }} />
        <DrillStat label="Pending follow-ups" value={pendingFollowUps} entity="followups" filters={{ doctorId: did, status: "pending,booked" }} />
        <DrillStat label="Pending lab tests" value={pendingLabs} entity="labReferrals" filters={{ status: "pending" }} />
        <DrillStat label="Open admission recs" value={openAdmissions} entity="admissions" filters={{ doctorId: did, status: "recommended,counselled,interested" }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Today&apos;s queue</h2>
            {queue.length === 0 ? <p className="text-sm text-slate-400">No patients waiting.</p> : (
              <div className="space-y-1">
                {queue.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                    <span>{b.startTime} · {b.patient.name} <span className="text-xs text-slate-400">· {b.department.name}</span></span>
                    <span className="flex items-center gap-2"><Badge tone="blue">{humanize(b.status)}</Badge><LinkButton href={`/consultations/${b.id}`} tone="ghost">Consult</LinkButton></span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">My recent consultations</div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Diagnosis</th><th className="px-4 py-2">Outcome</th></tr></thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-400">None.</td></tr>}
                {recent.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 text-slate-500">{iso(c.createdAt)}</td>
                    <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(c.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{c.patient.name}</Link></td>
                    <td className="px-4 py-2 text-slate-600">{c.diagnosis ?? "—"}</td>
                    <td className="px-4 py-2"><Badge tone={c.outcome === "no_treatment_required" ? "slate" : "blue"}>{humanize(c.outcome)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">My outcome mix</h3>
          {totalConsults === 0 ? <p className="text-sm text-slate-400">No consultations.</p> : (
            <div className="space-y-2">
              {outcomeGroups.sort((a, b) => b._count._all - a._count._all).map((g) => {
                const pct = Math.round((g._count._all / totalConsults) * 100);
                return (
                  <div key={g.outcome}>
                    <div className="flex justify-between text-xs"><span>{humanize(g.outcome)}</span><span className="text-slate-400">{g._count._all} · {pct}%</span></div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-700"><div className="h-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
