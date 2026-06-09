import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MODULE_DASHBOARDS } from "@/lib/modules/registry";
import { setManagedModules } from "@/lib/modules/actions";
import { PageHeader, Card, SubmitButton, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const GROUP_ORDER = ["Engagement", "Clinical", "Outreach", "Growth", "Workflow", "Admin"];

export default async function ModuleManagers() {
  await requireCan("masters", "edit");
  const staff = await prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  // Administrators can't be confined; everyone else is assignable.
  const assignable = staff.filter((s) => s.role !== "administrator");
  const groups = GROUP_ORDER.filter((g) => MODULE_DASHBOARDS.some((m) => m.group === g));

  return (
    <div>
      <PageHeader title="Department managers" subtitle="Appoint staff as managers (admins) of one or more modules — they are confined to what they own" />

      <div className="mb-4 text-sm">
        <Link href="/module-access" className="text-rose-700 hover:underline dark:text-rose-300">← Module access by role</Link>
      </div>

      <div className="space-y-4">
        {assignable.map((s) => {
          const owned = new Set((s.managedModules as string[]) ?? []);
          return (
            <Card key={s.id}>
              <form action={setManagedModules}>
                <input type="hidden" name="staffId" value={s.id} />
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{s.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{s.email}</span>
                    {owned.size > 0 && <Badge tone="green">manages {owned.size}</Badge>}
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
                            <input type="checkbox" name="modules" value={m.slug} defaultChecked={owned.has(m.slug)} className="rounded border-slate-300" />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
