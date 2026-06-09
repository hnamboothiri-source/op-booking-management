import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addMobilePatient } from "@/lib/outreach/actions";
import { computeOutreachKpis } from "@/lib/outreach/metrics";
import { can, budgetTotals, onSiteRevenue, expensesByCategory, type OutreachExpenseLine, type OutreachStaffLine, type OutreachRevenueLine, type PlanningChecklist } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { BudgetSection } from "@/components/outreach/BudgetSection";
import { PlanningSection, RosterSection, RevenueSection } from "@/components/outreach/OutreachEditors";
import { RoiSummary } from "@/components/outreach/RoiSummary";
import { PlanPanel } from "@/components/outreach/PlanPanel";
import { LocalPatients } from "@/components/outreach/LocalPatients";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function MobileClinicDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ referredToBranch?: string }> }) {
  const { id } = await params;
  const { referredToBranch } = await searchParams;
  const user = await requireCan("mobile_clinics", "view");
  const clinic = await prisma.mobileClinic.findUnique({ where: { id }, include: { patients: { orderBy: { createdAt: "desc" } } } });
  if (!clinic) notFound();
  const referred = clinic.patients.filter((p) => p.referredToBranch).length;
  const onlyReferred = referredToBranch === "true";
  const shown = onlyReferred ? clinic.patients.filter((p) => p.referredToBranch) : clinic.patients;

  const canEdit = can(user.role, "mobile_clinics", "edit");
  const expenses = (clinic.expenses as OutreachExpenseLine[] | null) ?? [];
  const roster = (clinic.staffRoster as OutreachStaffLine[] | null) ?? [];
  const revenueLines = (clinic.revenueLines as OutreachRevenueLine[] | null) ?? [];
  const planning = (clinic.planning as PlanningChecklist | null) ?? {};
  const totals = budgetTotals(expenses, roster);
  const byCat = expensesByCategory(expenses);
  const [kpis, branches, diseases, localPatients] = await Promise.all([
    computeOutreachKpis("mobile", id),
    prisma.branch.findMany(),
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    clinic.location ? prisma.patient.findMany({ where: { place: { contains: clinic.location, mode: "insensitive" } }, take: 50 }) : Promise.resolve([]),
  ]);
  const branchName = (bid: string) => branches.find((b) => b.id === bid)?.name ?? bid;

  return (
    <div>
      <PageHeader title={clinic.routeName} subtitle={clinic.location ?? ""} />
      <div className="mb-4"><Link href="/mobile-clinics" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Mobile clinics</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DrillStat label="Screened" value={clinic.patients.length} entity="mobileClinicPatients" filters={{ mobileClinicId: id }} />
        <DrillStat label="Referred to branch" value={referred} entity="mobileClinicPatients" filters={{ mobileClinicId: id, referredToBranch: "true" }} />
        <Card><div className="text-2xl font-bold">{clinic.patients.length ? Math.round((referred / clinic.patients.length) * 100) : 0}%</div><div className="text-xs text-slate-500 dark:text-slate-400">Conversion</div></Card>
      </div>

      <div className="mb-6 space-y-6">
        <PlanPanel eventType="mobile" id={id}
          plan={{ location: clinic.location, venue: clinic.venue, venueCapacity: clinic.venueCapacity, diseaseId: clinic.diseaseId, branchId: clinic.branchId, isRecurring: clinic.isRecurring, expectedPatients: clinic.expectedPatients, expectedAdmissions: clinic.expectedAdmissions }}
          rentPlanned={byCat.venue_rent?.planned ?? 0} adPlanned={byCat.marketing_ads?.planned ?? 0}
          branches={branches} diseases={diseases} canEdit={canEdit} />
        <LocalPatients eventType="mobile" id={id} location={clinic.location} patients={localPatients.map((p) => ({ mrd: p.mrd, name: p.name, phone: p.phone, place: p.place }))} canEdit={canEdit} />
        <RoiSummary plannedTotal={totals.plannedTotal} actualTotal={totals.actualTotal} onSite={onSiteRevenue(revenueLines)} kpis={kpis} branchName={branchName} />
        <div className="grid gap-6 lg:grid-cols-2">
          <PlanningSection eventType="mobile" id={id} planning={planning} canEdit={canEdit} />
          <RosterSection eventType="mobile" id={id} roster={roster} canEdit={canEdit} />
        </div>
        <BudgetSection eventType="mobile" id={id} expenses={expenses} roster={roster} canEdit={canEdit} />
        <RevenueSection eventType="mobile" id={id} lines={revenueLines} canEdit={canEdit} />
      </div>

      {can(user.role, "mobile_clinics", "edit") && (
        <Card>
          <h2 className="mb-3 font-semibold">Screen a patient</h2>
          <form action={addMobilePatient.bind(null, id)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="contactName" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Phone<input name="phone" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Age<input type="number" name="age" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Gender<select name="gender" className={input}><option value="">—</option><option value="male">male</option><option value="female">female</option><option value="other">other</option></select></label>
            <label className="text-xs font-medium text-slate-600">Complaint<input name="complaint" className={input} /></label>
            <label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" name="referredToBranch" className="h-4 w-4" /> Refer to branch</label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Add screening</SubmitButton></div>
          </form>
        </Card>
      )}

      <ActiveFilters filters={onlyReferred ? { referredToBranch: "true" } : {}} basePath={`/mobile-clinics/${id}`} />

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Complaint</th><th className="px-4 py-2">Referred?</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No screenings{onlyReferred ? " referred to a branch" : " yet"}.</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">{p.contactName}</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.phone ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.complaint ?? "—"}</td>
                <td className="px-4 py-2">{p.referredToBranch ? <Badge tone="green">referred</Badge> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
