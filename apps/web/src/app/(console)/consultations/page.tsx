import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, Badge } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";

const OUTCOMES = [
  "medicine_prescribed", "test_recommended", "follow_up_advised", "admission_advised",
  "surgery_or_procedure_advised", "referred_to_department", "no_treatment_required",
];

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("consultations", "view");
  const filters = listFilters("consultations", await searchParams);
  const outcome = filters.outcome;

  const consultations = await prisma.consultation.findMany({
    where: { ...branchScopeWhere(user.role, user.branchId), ...DRILL.consultations.buildWhere(filters) },
    include: { patient: true, doctor: true, department: true, disease: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Consultations" subtitle={`${consultations.length} consultation${consultations.length === 1 ? "" : "s"} (Module 5)`} />

      <ActiveFilters filters={filters} basePath="/consultations" />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/consultations" className={`rounded-full px-3 py-1 ${!outcome ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>All</Link>
        {OUTCOMES.map((o) => (
          <Link key={o} href={`/consultations?outcome=${o}`} className={`rounded-full px-3 py-1 ${outcome === o ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
            {o.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Patient</th>
              <th className="px-4 py-2 font-medium">Doctor</th><th className="px-4 py-2 font-medium">Dept</th>
              <th className="px-4 py-2 font-medium">Diagnosis</th><th className="px-4 py-2 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {consultations.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No consultations.</td></tr>}
            {consultations.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{c.createdAt.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(c.patientMrd)}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">{c.patient.name}</Link></td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.doctor.name}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.department.name}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.diagnosis ?? c.disease?.name ?? "—"}</td>
                <td className="px-4 py-2"><Badge tone="green">{c.outcome.replace(/_/g, " ")}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
