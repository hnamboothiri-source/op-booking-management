import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MODULE_DASHBOARDS } from "@/lib/modules/registry";
import { setBranchModules } from "@/lib/modules/actions";
import { PageHeader, Card, SubmitButton, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const GROUP_ORDER = ["Engagement", "Clinical", "Outreach", "Growth", "Workflow", "Admin"];
const TYPE_LABEL: Record<string, string> = {
  flagship_hospital: "Flagship",
  hospital: "Hospital",
  op_centre: "OP centre",
};

/**
 * Module allotment per centre: which modules each hospital / OP centre runs.
 * Empty selection = ALL modules. Centre staff (and anyone switched into the
 * centre) only see the allotted modules; centre plans are confined to them.
 */
export default async function BranchModules() {
  await requireCan("masters", "edit");
  const [branches, companies] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const groups = GROUP_ORDER.filter((g) => MODULE_DASHBOARDS.some((m) => m.group === g));

  return (
    <div>
      <PageHeader title="Module allotment by centre" subtitle="Allot the modules each hospital / OP centre runs — centre staff see only what their centre is allotted" />

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link href="/module-access" className="text-rose-700 hover:underline dark:text-rose-300">← Module access by role</Link>
        <Link href="/module-access/managers" className="text-rose-700 hover:underline dark:text-rose-300">Department managers →</Link>
        <Link href="/masters/branches/new" className="text-rose-700 hover:underline dark:text-rose-300">＋ New centre</Link>
        <Link href="/masters/departments/new" className="text-rose-700 hover:underline dark:text-rose-300">＋ New department</Link>
      </div>

      <div className="space-y-6">
        {companies.map((co) => (
          <section key={co.id}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{co.shortName ?? co.name}</h2>
            <div className="space-y-4">
              {branches.filter((b) => b.companyId === co.id).map((b) => {
                const enabled = new Set((b.enabledModules as string[]) ?? []);
                const all = enabled.size === 0;
                return (
                  <Card key={b.id}>
                    <form action={setBranchModules}>
                      <input type="hidden" name="branchId" value={b.id} />
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-100">{b.name}</span>
                          <Badge tone={b.type === "flagship_hospital" ? "green" : b.type === "op_centre" ? "amber" : "slate"}>{TYPE_LABEL[String(b.type)] ?? String(b.type)}</Badge>
                          {all ? <Badge tone="blue">all modules</Badge> : <Badge tone="slate">{enabled.size} allotted</Badge>}
                        </div>
                        <SubmitButton>Save</SubmitButton>
                      </div>
                      <div className="space-y-3">
                        {groups.map((group) => (
                          <div key={group}>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                              {MODULE_DASHBOARDS.filter((m) => m.group === group).map((m) => (
                                <label key={m.slug} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                                  <input type="checkbox" name="modules" value={m.slug} defaultChecked={enabled.has(m.slug)} className="rounded border-slate-300" />
                                  {m.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">Tick nothing to give this centre every module.</p>
                    </form>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
