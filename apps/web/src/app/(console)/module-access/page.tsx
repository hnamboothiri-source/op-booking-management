import Link from "next/link";
import { requireCan } from "@/lib/session";
import { can, ROLE_GRANTS, type RoleName } from "@prm/core";
import { MODULE_DASHBOARDS } from "@/lib/modules/registry";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const humanize = (s: string) => s.replace(/_/g, " ");

export default async function ModuleAccess() {
  await requireCan("masters", "view");
  const roles = Object.keys(ROLE_GRANTS) as RoleName[];

  const rows = roles.map((role) => ({
    role,
    cells: MODULE_DASHBOARDS.map((m) => can(role, m.resource, "view")),
  }));

  return (
    <div>
      <PageHeader title="Module access by role" subtitle="Which department / role can see which module — drives the per-department rollout" />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/module-access/managers" className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Appoint department managers →</Link>
        <Link href="/module-access/branches" className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300">Module allotment by centre →</Link>
      </div>

      <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left dark:bg-slate-900">Role</th>
              {MODULE_DASHBOARDS.map((m) => (
                <th key={m.id} className="px-2 py-2 text-center" title={m.name}>{m.id}</th>
              ))}
              <th className="px-3 py-2 text-right">Modules</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.role} className="border-t border-slate-100 dark:border-slate-700">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium capitalize dark:bg-slate-800">{humanize(r.role)}</td>
                {r.cells.map((ok, i) => (
                  <td key={MODULE_DASHBOARDS[i].id} className="px-2 py-2 text-center">
                    {ok ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{r.cells.filter(Boolean).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Module legend</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {MODULE_DASHBOARDS.map((m) => (
            <div key={m.id}><span className="font-semibold text-rose-700 dark:text-rose-300">{m.id}</span> <span className="text-slate-600 dark:text-slate-300">{m.name}</span></div>
          ))}
        </div>
      </Card>

      <p className="mt-4 text-xs text-slate-400">Access is governed by role-based permissions (RBAC). Assign a staff member the role for their department and they see only these modules in the sidebar.</p>
    </div>
  );
}
