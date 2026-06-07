import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function Table({ title, rows }: { title: string; rows: { label: string; value: number | string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && <tr><td className="px-4 py-3 text-slate-400">No data.</td></tr>}
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="px-4 py-2">{r.label}</td>
              <td className="px-4 py-2 text-right font-medium">{r.value}</td>
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

  const dName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? "Unknown";
  const disName = (id: string | null) => diseases.find((d) => d.id === id)?.name ?? "Unspecified";
  const sName = (id: string | null) => sources.find((s) => s.id === id)?.name?.replace(/_/g, " ") ?? "Unknown";

  const csvLink = "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50";
  return (
    <div>
      <PageHeader title="Reports" subtitle="Operational & clinical aggregations (§6)" />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Export CSV:</span>
        <a className={csvLink} href="/api/reports/export?type=leads-by-source">Leads by source</a>
        <a className={csvLink} href="/api/reports/export?type=appointments-by-status">Appointments by status</a>
        <a className={csvLink} href="/api/reports/export?type=consultations-by-doctor">Consultations by doctor</a>
        <a className={csvLink} href="/api/reports/export?type=admission-funnel">Admission funnel</a>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Table title="Consultations by doctor" rows={byDoctor.map((r) => ({ label: dName(r.doctorId), value: r._count._all }))} />
        <Table title="Consultation outcomes" rows={byOutcome.map((r) => ({ label: r.outcome.replace(/_/g, " "), value: r._count._all }))} />
        <Table title="Patients by diagnosis category" rows={byDisease.map((r) => ({ label: disName(r.diseaseId), value: r._count._all }))} />
        <Table title="Admission funnel" rows={admissionByStatus.map((r) => ({ label: r.status, value: r._count._all }))} />
        <Table title="Appointments by status" rows={apptByStatus.map((r) => ({ label: r.status.replace(/_/g, " "), value: r._count._all }))} />
        <Table title="Leads by source" rows={leadBySource.map((r) => ({ label: sName(r.sourceId), value: r._count._all }))} />
      </div>
    </div>
  );
}
