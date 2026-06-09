import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createCamp } from "@/lib/outreach/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillCount } from "@/components/drill/DrillCount";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { PlanActivitySelect } from "@/components/planning/PlanActivitySelect";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function Camps({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("camps", "view");
  const filters = listFilters("camps", await searchParams);
  const [camps, orgs, branches, diseases] = await Promise.all([
    prisma.camp.findMany({ where: DRILL.camps.buildWhere(filters), include: { organizer: true, _count: { select: { campPatients: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Camps" subtitle="Outreach camps — screened → converted → revenue (Module 7)" />
      {can(user.role, "camps", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New camp</h2>
          <form action={createCamp} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="name" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Location<input name="location" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Run by (branch)<select name="branchId" className={input}><option value="">Main hospital</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Target disease<select name="diseaseId" className={input}><option value="">—</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Organizer<select name="organizerId" className={input}><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Date<input type="date" name="scheduledAt" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Expected patients<input type="number" name="expectedPatients" className={input} /></label>
            <label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" name="isRecurring" className="h-4 w-4" /> Recurring camp</label>
            <div className="sm:col-span-2"><PlanActivitySelect slug="camps" typeKey="conduct_camp" /></div>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Create camp</SubmitButton></div>
          </form>
          <p className="mt-2 text-xs text-slate-400">A camp can only be created from an approved plan activity (planning-first).</p>
        </Card>
      )}

      <ActiveFilters filters={filters} basePath="/camps" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {camps.length === 0 && <p className="text-sm text-slate-400">No camps yet.</p>}
        {camps.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <Link href={`/camps/${c.id}`} className="font-semibold text-rose-700 hover:underline dark:text-rose-400">{c.name}</Link>
              <Badge tone={c.status === "completed" ? "green" : "slate"}>{c.status}</Badge>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.location ?? "—"}{c.organizer ? ` · ${c.organizer.name}` : ""}</div>
            <div className="mt-2 text-sm">
              <DrillCount value={c._count.campPatients} entity="campPatients" filters={{ campId: c.id }} label={`${c.name} · screened`} /> screened · ₹{(c.revenue / 100).toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
