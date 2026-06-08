import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionAdmission } from "@/lib/admissions/actions";
import { nextAdmissionStatuses, admissionNeedsReason, admissionConversionRate, can, type AdmissionStatus } from "@prm/core";
import { PageHeader, Badge, Card } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillStat } from "@/components/drill/DrillStat";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";

const REJECTION_REASONS = ["cost_concern", "family_decision_pending", "seeking_second_opinion", "travel_difficulty", "fear_of_admission", "treatment_postponed", "chose_another_hospital"];
const PENDING_STATUSES = "recommended,counselled,interested,postponed,accepted";
const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  recommended: "blue", counselled: "amber", interested: "amber", postponed: "slate",
  accepted: "green", admitted: "green", rejected: "red", lost: "red",
};

export default async function Admissions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("admissions", "view");
  const canEdit = can(user.role, "admissions", "edit");
  const filters = listFilters("admissions", await searchParams);

  const [recs, groups] = await Promise.all([
    prisma.admissionRecommendation.findMany({
      where: DRILL.admissions.buildWhere(filters),
      include: { patient: true, package: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    // Unfiltered status totals for the drill tiles.
    prisma.admissionRecommendation.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const cnt = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const total = groups.reduce((a, g) => a + g._count._all, 0);
  const admitted = cnt("admitted");
  const lost = cnt("rejected") + cnt("lost");
  const pending = total - admitted - lost;

  return (
    <div>
      <PageHeader title="Admission conversion" subtitle="Track advised admissions and improve conversion (Module 10)" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Recommended" value={total} entity="admissions" filters={{}} />
        <DrillStat label="In funnel" value={pending} entity="admissions" filters={{ status: PENDING_STATUSES }} />
        <DrillStat label="Admitted" value={admitted} entity="admissions" filters={{ status: "admitted" }} />
        <Card><div className="text-2xl font-bold">{admissionConversionRate(admitted, total)}%</div><div className="text-xs text-slate-500 dark:text-slate-400">Conversion ({lost} lost)</div></Card>
      </div>

      <ActiveFilters filters={filters} basePath="/admissions" />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Package</th><th className="px-4 py-2">Est. cost</th><th className="px-4 py-2">Status</th>{canEdit && <th className="px-4 py-2">Actions</th>}</tr>
          </thead>
          <tbody>
            {recs.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-slate-400">No admission recommendations yet. They are created from consultations.</td></tr>}
            {recs.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(r.patientMrd)}`} className="font-medium text-emerald-700 hover:underline">{r.patient.name}</Link></td>
                <td className="px-4 py-2 text-slate-600">{r.package?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{r.estimatedCost ? `₹${(r.estimatedCost / 100).toLocaleString("en-IN")}` : "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={TONE[r.status]}>{r.status}</Badge>
                  {r.rejectionReason && <div className="mt-1 text-xs text-red-500">{r.rejectionReason.replace(/_/g, " ")}</div>}
                </td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {nextAdmissionStatuses(r.status as AdmissionStatus).map((s) =>
                        admissionNeedsReason(s) ? (
                          <form key={s} action={transitionAdmission.bind(null, r.id, s)} className="flex items-center gap-1">
                            <select name="rejectionReason" className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">reason…</option>{REJECTION_REASONS.map((rr) => <option key={rr} value={rr}>{rr.replace(/_/g, " ")}</option>)}</select>
                            <button className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50">{s}</button>
                          </form>
                        ) : (
                          <form key={s} action={transitionAdmission.bind(null, r.id, s)}>
                            <button className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50">{s}</button>
                          </form>
                        ),
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
