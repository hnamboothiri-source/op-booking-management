import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createMobileClinic } from "@/lib/outreach/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillCount } from "@/components/drill/DrillCount";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { PlanActivitySelect } from "@/components/planning/PlanActivitySelect";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function MobileClinics({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("mobile_clinics", "view");
  const filters = listFilters("mobileClinics", await searchParams);
  const [clinics, branches, diseases] = await Promise.all([
    prisma.mobileClinic.findMany({ where: DRILL.mobileClinics.buildWhere(filters), include: { _count: { select: { patients: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Mobile clinics" subtitle="Route-based screening & conversion (Module 8)" />
      {can(user.role, "mobile_clinics", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New route</h2>
          <form action={createMobileClinic} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Route name<input name="routeName" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Location<input name="location" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Run by (branch)<select name="branchId" className={input}><option value="">Main hospital</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Target disease<select name="diseaseId" className={input}><option value="">—</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Date<input type="date" name="scheduledAt" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Expected patients<input type="number" name="expectedPatients" className={input} /></label>
            <label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" name="isRecurring" className="h-4 w-4" /> Recurring route</label>
            <div className="sm:col-span-2"><PlanActivitySelect slug="mobile-clinics" typeKey="run_route" /></div>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Create route</SubmitButton></div>
          </form>
        </Card>
      )}
      <ActiveFilters filters={filters} basePath="/mobile-clinics" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clinics.length === 0 && <p className="text-sm text-slate-400">No routes yet.</p>}
        {clinics.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <Link href={`/mobile-clinics/${c.id}`} className="font-semibold text-rose-700 hover:underline dark:text-rose-400">{c.routeName}</Link>
              <Badge tone={c.status === "completed" ? "green" : "slate"}>{c.status}</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.location ?? "—"}</div>
            <div className="mt-2 text-sm">
              <DrillCount value={c._count.patients} entity="mobileClinicPatients" filters={{ mobileClinicId: c.id }} label={`${c.routeName} · screened`} /> screened
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
