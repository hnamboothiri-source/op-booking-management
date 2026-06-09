import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";

const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  pending: "amber", booked: "blue", done: "green", overdue: "red", missed: "red", cancelled: "slate",
};

export default async function ConversionTests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireCan("consultations", "view");
  const filters = listFilters("labReferrals", await searchParams);

  const rows = await prisma.labReferral.findMany({
    where: DRILL.labReferrals.buildWhere(filters),
    include: { consultation: { include: { patient: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader title="Tests" subtitle="Lab/test referrals from consultations — Consultation → Test (Module 17)" />
      <ActiveFilters filters={filters} basePath="/conversion/tests" />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Test</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No test referrals.</td></tr>}
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">
                  {l.consultation?.patientMrd
                    ? <Link href={`/patients/${encodeURIComponent(l.consultation.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{l.consultation.patient?.name ?? l.consultation.patientMrd}</Link>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{l.testName}</td>
                <td className="px-4 py-2"><Badge tone={TONE[l.status] ?? "slate"}>{l.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
