import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";

const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  planned: "amber", in_progress: "blue", completed: "green", discontinued: "red",
};

export default async function ConversionTreatments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireCan("consultations", "view");
  const filters = listFilters("treatmentPlans", await searchParams);

  const rows = await prisma.treatmentPlan.findMany({
    where: DRILL.treatmentPlans.buildWhere(filters),
    include: { consultation: { include: { patient: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader title="Treatments" subtitle="Treatment plans & progress — Test → Treatment (Module 17)" />
      <ActiveFilters filters={filters} basePath="/conversion/treatments" />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Duration</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No treatment plans.</td></tr>}
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">
                  {t.consultation?.patientMrd
                    ? <Link href={`/patients/${encodeURIComponent(t.consultation.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{t.consultation.patient?.name ?? t.consultation.patientMrd}</Link>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{t.summary}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{t.durationDays ? `${t.durationDays} days` : "—"}</td>
                <td className="px-4 py-2"><Badge tone={TONE[t.status] ?? "slate"}>{t.status.replace(/_/g, " ")}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
