import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addCampPatient } from "@/lib/outreach/actions";
import { computeOutreachKpis, outreachFunnel } from "@/lib/outreach/metrics";
import { can, budgetTotals, onSiteRevenue, expensesByCategory, SCREENING_RISKS, SCREENING_RISK_LABELS, riskTone, type ScreeningRisk, type OutreachExpenseLine, type OutreachStaffLine, type OutreachRevenueLine, type PlanningChecklist } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { LeadFunnelChart } from "@/components/charts/LeadFunnelChart";
import { DrillStat } from "@/components/drill/DrillStat";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { BudgetSection } from "@/components/outreach/BudgetSection";
import { PlanningSection, RosterSection, RevenueSection } from "@/components/outreach/OutreachEditors";
import { RoiSummary } from "@/components/outreach/RoiSummary";
import { PlanPanel } from "@/components/outreach/PlanPanel";
import { LocalPatients } from "@/components/outreach/LocalPatients";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function CampDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ recommendedVisit?: string }> }) {
  const { id } = await params;
  const { recommendedVisit } = await searchParams;
  const user = await requireCan("camps", "view");
  const camp = await prisma.camp.findUnique({
    where: { id },
    include: { organizer: true, campPatients: { orderBy: { createdAt: "desc" } } },
  });
  if (!camp) notFound();
  const recommended = camp.campPatients.filter((p) => p.recommendedVisit).length;
  // The patient-count drill lands here with ?recommendedVisit=true.
  const onlyRecommended = recommendedVisit === "true";
  const shown = onlyRecommended ? camp.campPatients.filter((p) => p.recommendedVisit) : camp.campPatients;

  const canEdit = can(user.role, "camps", "edit");
  const expenses = (camp.expenses as OutreachExpenseLine[] | null) ?? [];
  const roster = (camp.staffRoster as OutreachStaffLine[] | null) ?? [];
  const revenueLines = (camp.revenueLines as OutreachRevenueLine[] | null) ?? [];
  const planning = (camp.planning as PlanningChecklist | null) ?? {};
  const totals = budgetTotals(expenses, roster);
  const byCat = expensesByCategory(expenses);
  const [kpis, branches, diseases, staff, localPatients] = await Promise.all([
    computeOutreachKpis("camp", id),
    prisma.branch.findMany(),
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    camp.location ? prisma.patient.findMany({ where: { place: { contains: camp.location, mode: "insensitive" } }, take: 50 }) : Promise.resolve([]),
  ]);
  const branchName = (bid: string) => branches.find((b) => b.id === bid)?.name ?? bid;
  const staffName = (sid: string | null) => staff.find((s) => s.id === sid)?.name ?? "—";

  return (
    <div>
      <PageHeader title={camp.name} subtitle={`${camp.location ?? ""}${camp.organizer ? ` · ${camp.organizer.name}` : ""}`} />
      <div className="mb-4"><Link href="/camps" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Camps</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Screened" value={camp.campPatients.length} entity="campPatients" filters={{ campId: id }} />
        <DrillStat label="Recommended visit" value={recommended} entity="campPatients" filters={{ campId: id, recommendedVisit: "true" }} />
        <Card><div className="text-2xl font-bold">{camp.campPatients.length ? Math.round((recommended / camp.campPatients.length) * 100) : 0}%</div><div className="text-xs text-slate-500 dark:text-slate-400">Conversion</div></Card>
        <Card><div className="text-2xl font-bold">{camp.isRecurring ? "Recurring" : "One-off"}</div><div className="text-xs text-slate-500 dark:text-slate-400">{branchName(camp.branchId ?? "") !== (camp.branchId ?? "") ? `Run by ${branchName(camp.branchId ?? "")}` : "Camp type"}</div></Card>
      </div>

      <div className="mb-6 space-y-6">
        <PlanPanel eventType="camp" id={id}
          plan={{ location: camp.location, venue: camp.venue, venueCapacity: camp.venueCapacity, diseaseId: camp.diseaseId, branchId: camp.branchId, isRecurring: camp.isRecurring, expectedPatients: camp.expectedPatients, expectedAdmissions: camp.expectedAdmissions }}
          rentPlanned={byCat.venue_rent?.planned ?? 0} adPlanned={byCat.marketing_ads?.planned ?? 0}
          branches={branches} diseases={diseases} canEdit={canEdit} />
        <LocalPatients eventType="camp" id={id} location={camp.location} patients={localPatients.map((p) => ({ mrd: p.mrd, name: p.name, phone: p.phone, place: p.place }))} canEdit={canEdit} />
        <RoiSummary plannedTotal={totals.plannedTotal} actualTotal={totals.actualTotal} onSite={onSiteRevenue(revenueLines)} kpis={kpis} branchName={branchName} />
        <Card>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Conversion funnel</h3>
          <LeadFunnelChart stages={outreachFunnel(kpis)} />
          <p className="mt-2 text-xs text-slate-400">Screened → recommended → appointment → consulted → treatment → admitted (traced from this camp&apos;s leads).</p>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <PlanningSection eventType="camp" id={id} planning={planning} canEdit={canEdit} />
          <RosterSection eventType="camp" id={id} roster={roster} canEdit={canEdit} />
        </div>
        <BudgetSection eventType="camp" id={id} expenses={expenses} roster={roster} canEdit={canEdit} />
        <RevenueSection eventType="camp" id={id} lines={revenueLines} canEdit={canEdit} />
      </div>

      {can(user.role, "camps", "edit") && (
        <Card>
          <h2 className="mb-3 font-semibold">Screen a patient</h2>
          <form action={addCampPatient.bind(null, id)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="contactName" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Phone<input name="phone" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Age<input type="number" name="age" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Gender<select name="gender" className={input}><option value="">—</option><option value="male">male</option><option value="female">female</option><option value="other">other</option></select></label>
            <label className="text-xs font-medium text-slate-600">Complaint<input name="complaint" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Risk category<select name="riskCategory" className={input}>{SCREENING_RISKS.map((r) => <option key={r} value={r}>{SCREENING_RISK_LABELS[r]}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Screened by<select name="screenedById" className={input}><option value="">— me —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Add screening</SubmitButton></div>
          </form>
          <p className="mt-2 text-xs text-slate-400">Any risk above &ldquo;normal&rdquo; recommends a hospital visit and (with a phone) becomes a camp-tagged lead automatically.</p>
        </Card>
      )}

      <ActiveFilters filters={onlyRecommended ? { recommendedVisit: "true" } : {}} basePath={`/camps/${id}`} />

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Complaint</th><th className="px-4 py-2">Risk</th><th className="px-4 py-2">Screened by</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No screenings{onlyRecommended ? " recommended for a visit" : " yet"}.</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2">{p.contactName}</td><td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.phone ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.complaint ?? "—"}</td>
                <td className="px-4 py-2"><Badge tone={riskTone(p.riskCategory as ScreeningRisk)}>{SCREENING_RISK_LABELS[p.riskCategory as ScreeningRisk]}</Badge></td>
                <td className="px-4 py-2 text-slate-500">{staffName(p.screenedById)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
