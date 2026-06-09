import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { conversionRate } from "@prm/core";
import { PageHeader, Card } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { TreatmentFunnelChart } from "@/components/charts/TreatmentFunnelChart";
import type { FunnelStage } from "@/components/charts/LeadFunnelChart";

export const dynamic = "force-dynamic";

export default async function ConversionDashboard() {
  await requireCan("reports", "view");

  const [consultations, tests, testsDone, treatments, treatmentsDone, admissionGroups] = await Promise.all([
    prisma.consultation.count(),
    prisma.labReferral.count(),
    prisma.labReferral.count({ where: { status: "done" } }),
    prisma.treatmentPlan.count(),
    prisma.treatmentPlan.count({ where: { status: "completed" } }),
    prisma.admissionRecommendation.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const admStatus = (s: string) => admissionGroups.find((g) => g.status === s)?._count._all ?? 0;
  const admissionsTotal = admissionGroups.reduce((a, g) => a + g._count._all, 0);
  const admitted = admStatus("admitted");

  // Each funnel stage carries its drill entity/filters so the bar is clickable.
  const stages: FunnelStage[] = [
    { label: "Consultations", value: consultations, entity: "consultations", filters: {} },
    { label: "Tests advised", value: tests, entity: "labReferrals", filters: {} },
    { label: "Treatment plans", value: treatments, entity: "treatmentPlans", filters: {} },
    { label: "Admissions advised", value: admissionsTotal, entity: "admissions", filters: {} },
    { label: "Admitted", value: admitted, entity: "admissions", filters: { status: "admitted" } },
  ];

  // Stage-to-stage conversion (how much of each step flows to the next).
  const legs = [
    { label: "Consultation → Test", rate: conversionRate(tests, consultations), sub: `${tests} of ${consultations} consultations` },
    { label: "Test → Treatment", rate: conversionRate(treatments, tests), sub: `${treatments} of ${tests} tests` },
    { label: "Treatment → Admission", rate: conversionRate(admissionsTotal, treatments), sub: `${admissionsTotal} of ${treatments} treatments` },
    { label: "Admission → Admitted", rate: conversionRate(admitted, admissionsTotal), sub: `${admitted} of ${admissionsTotal} recommended` },
  ];

  return (
    <div>
      <PageHeader title="Treatment Conversion" subtitle="Consultation → Test → Treatment → Admission (Module 17)" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <DrillStat label="Consultations" value={consultations} entity="consultations" filters={{}} />
        <DrillStat label="Tests advised" value={tests} entity="labReferrals" filters={{}} sub={`${testsDone} completed`} />
        <DrillStat label="Treatment plans" value={treatments} entity="treatmentPlans" filters={{}} sub={`${treatmentsDone} completed`} />
        <DrillStat label="Admissions advised" value={admissionsTotal} entity="admissions" filters={{}} />
        <DrillStat label="Admitted" value={admitted} entity="admissions" filters={{ status: "admitted" }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Conversion funnel</h2>
          <TreatmentFunnelChart stages={stages} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Stage conversion rates</h2>
          <div className="space-y-2">
            {legs.map((l) => (
              <div key={l.label} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                <span>
                  {l.label}
                  <span className="block text-xs text-slate-400">{l.sub}</span>
                </span>
                <span className="text-lg font-bold text-rose-700 dark:text-rose-300">{l.rate}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
