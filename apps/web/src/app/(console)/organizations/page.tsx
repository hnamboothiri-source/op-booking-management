import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createOrganization } from "@/lib/organizations/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillCount } from "@/components/drill/DrillCount";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const TYPES = ["company", "school", "college", "ngo", "panchayat", "religious_institution", "association", "senior_citizen_group"];

export default async function Organizations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("organizations", "view");
  const filters = listFilters("organizations", await searchParams);
  const orgs = await prisma.organization.findMany({ where: DRILL.organizations.buildWhere(filters), include: { _count: { select: { camps: true, referrals: true } } }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader title="Corporate & institutional" subtitle="Organizations that generate patients (Module 14)" />
      {can(user.role, "organizations", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New organization</h2>
          <form action={createOrganization} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="name" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Type<select name="type" className={input}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Next engagement<input type="date" name="nextEngagement" className={input} /></label>
            <label className="col-span-2 sm:col-span-1 text-xs font-medium text-slate-600">Contacts (one per line)<input name="contactPersons" placeholder="Name, role" className={input} /></label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Add organization</SubmitButton></div>
          </form>
        </Card>
      )}
      <ActiveFilters filters={filters} basePath="/organizations" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.length === 0 && <p className="text-sm text-slate-400">No organizations yet.</p>}
        {orgs.map((o) => (
          <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <Link href={`/organizations/${o.id}`} className="font-semibold text-rose-700 hover:underline dark:text-rose-400">{o.name}</Link>
              <Badge tone="blue">{o.type.replace(/_/g, " ")}</Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <DrillCount value={o._count.camps} entity="camps" filters={{ organizerId: o.id }} label={`${o.name} · camps`} /> camps ·{" "}
              <DrillCount value={o._count.referrals} entity="referrals" filters={{ organizationId: o.id }} label={`${o.name} · referrals`} /> referrals
            </div>
            {o.nextEngagement && <div className="mt-1 text-xs text-amber-600">Next: {o.nextEngagement.toISOString().slice(0, 10)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
