import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";
import { conversionRate, admissionConversionRate, type DrillEntity, type DrillFilters } from "@prm/core";

export const dynamic = "force-dynamic";

interface ReportRow {
  label: string;
  value: number | string;
  drill?: { entity: DrillEntity; filters: DrillFilters };
}

function Table({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && <tr><td className="px-4 py-3 text-slate-400">No data.</td></tr>}
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100 dark:border-slate-700">
              <td className="px-4 py-2">{r.label}</td>
              <td className="px-4 py-2 text-right font-medium">
                {r.drill ? <DrillCount value={r.value} entity={r.drill.entity} filters={r.drill.filters} label={`${title} · ${r.label}`} /> : r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Reports() {
  await requireCan("reports", "view");

  const [byDoctor, byOutcome, byDisease, admissionByStatus, apptByStatus, leadBySource, doctors, diseases, sources] = await Promise.all([
    prisma.consultation.groupBy({ by: ["doctorId"], _count: { _all: true } }),
    prisma.consultation.groupBy({ by: ["outcome"], _count: { _all: true } }),
    prisma.consultation.groupBy({ by: ["diseaseId"], _count: { _all: true } }),
    prisma.admissionRecommendation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.opBooking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["sourceId"], _count: { _all: true } }),
    prisma.doctor.findMany(),
    prisma.diseaseMaster.findMany(),
    prisma.leadSourceMaster.findMany(),
  ]);

  // --- Follow-up & Treatment Conversion aggregations (Module 17) ---
  const [followUpGroups, followUpsDone, consultationCount, testCount, treatmentCount] = await Promise.all([
    prisma.followUp.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.followUp.findMany({ where: { status: "done" }, select: { dueDate: true, completedAt: true } }),
    prisma.consultation.count(),
    prisma.labReferral.count(),
    prisma.treatmentPlan.count(),
  ]);
  const fuCount = (s: string) => followUpGroups.find((g) => g.status === s)?._count._all ?? 0;
  const fuTotal = followUpGroups.reduce((a, g) => a + g._count._all, 0);
  const fuClosed = fuCount("done") + fuCount("missed");
  const onTime = followUpsDone.filter((f) => f.completedAt && f.dueDate && new Date(f.completedAt) <= new Date(f.dueDate)).length;
  const admittedTotal = admissionByStatus.find((g) => g.status === "admitted")?._count._all ?? 0;
  const admissionTotal = admissionByStatus.reduce((a, g) => a + g._count._all, 0);

  const dName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? "Unknown";
  const disName = (id: string | null) => diseases.find((d) => d.id === id)?.name ?? "Unspecified";
  const sName = (id: string | null) => sources.find((s) => s.id === id)?.name?.replace(/_/g, " ") ?? "Unknown";

  const csvLink = "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50";
  return (
    <div>
      <PageHeader title="Reports" subtitle="Operational & clinical aggregations (§6)" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/reports/leads" className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">📊 Lead Management report →</Link>
        <Link href="/reports/appointments" className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">📅 Appointment report →</Link>
        <Link href="/reports/doctor-utilisation" className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">🩺 Doctor utilisation →</Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Export CSV:</span>
        <a className={csvLink} href="/api/reports/export?type=leads-by-source">Leads by source</a>
        <a className={csvLink} href="/api/reports/export?type=appointments-by-status">Appointments by status</a>
        <a className={csvLink} href="/api/reports/export?type=consultations-by-doctor">Consultations by doctor</a>
        <a className={csvLink} href="/api/reports/export?type=admission-funnel">Admission funnel</a>
        <a className={csvLink} href="/api/reports/export?type=follow-up-compliance">Follow-up compliance</a>
        <a className={csvLink} href="/api/reports/export?type=treatment-funnel">Treatment funnel</a>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Table title="Consultations by doctor" rows={byDoctor.map((r) => ({ label: dName(r.doctorId), value: r._count._all, drill: { entity: "consultations", filters: { doctorId: r.doctorId } } }))} />
        <Table title="Consultation outcomes" rows={byOutcome.map((r) => ({ label: r.outcome.replace(/_/g, " "), value: r._count._all, drill: { entity: "consultations", filters: { outcome: r.outcome } } }))} />
        <Table title="Patients by diagnosis category" rows={byDisease.map((r) => ({ label: disName(r.diseaseId), value: r._count._all, ...(r.diseaseId ? { drill: { entity: "consultations", filters: { diseaseId: r.diseaseId } } } : {}) }))} />
        <Table title="Admission funnel" rows={admissionByStatus.map((r) => ({ label: r.status, value: r._count._all, drill: { entity: "admissions", filters: { status: r.status } } }))} />
        <Table title="Appointments by status" rows={apptByStatus.map((r) => ({ label: r.status.replace(/_/g, " "), value: r._count._all, drill: { entity: "appointments", filters: { status: r.status } } }))} />
        <Table title="Leads by source" rows={leadBySource.map((r) => ({ label: sName(r.sourceId), value: r._count._all, ...(r.sourceId ? { drill: { entity: "leads", filters: { sourceId: r.sourceId } } } : {}) }))} />
        <Table title="Follow-up compliance" rows={[
          { label: "Completed (on time)", value: onTime, drill: { entity: "followups", filters: { status: "done" } } },
          { label: "Completed (total)", value: fuCount("done"), drill: { entity: "followups", filters: { status: "done" } } },
          { label: "Missed", value: fuCount("missed"), drill: { entity: "followups", filters: { status: "missed" } } },
          { label: "Open (pending/booked)", value: fuCount("pending") + fuCount("booked"), drill: { entity: "followups", filters: { status: "pending,booked" } } },
          { label: "On-time compliance %", value: `${conversionRate(onTime, fuClosed)}%` },
          { label: "Total follow-ups", value: fuTotal },
        ]} />
        <Table title="Admission conversion rate" rows={[
          { label: "Recommended (total)", value: admissionTotal, drill: { entity: "admissions", filters: {} } },
          { label: "Admitted", value: admittedTotal, drill: { entity: "admissions", filters: { status: "admitted" } } },
          { label: "Conversion rate %", value: `${admissionConversionRate(admittedTotal, admissionTotal)}%` },
        ]} />
        <Table title="Treatment conversion funnel" rows={[
          { label: "Consultations", value: consultationCount, drill: { entity: "consultations", filters: {} } },
          { label: "Tests advised", value: testCount, drill: { entity: "labReferrals", filters: {} } },
          { label: "Treatment plans", value: treatmentCount, drill: { entity: "treatmentPlans", filters: {} } },
          { label: "Admissions advised", value: admissionTotal, drill: { entity: "admissions", filters: {} } },
          { label: "Admitted", value: admittedTotal, drill: { entity: "admissions", filters: { status: "admitted" } } },
          { label: "Consultation → Test %", value: `${conversionRate(testCount, consultationCount)}%` },
          { label: "Test → Treatment %", value: `${conversionRate(treatmentCount, testCount)}%` },
        ]} />
      </div>
    </div>
  );
}
