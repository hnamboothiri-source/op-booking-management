import Link from "next/link";
import { formatINR } from "@prm/core";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MODULE_DASHBOARDS } from "@/lib/modules/registry";
import { saveActivityMaster } from "@/lib/masterplan/activityActions";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600 dark:text-slate-300";

function ActivityFields({ a }: { a: Record<string, unknown> | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <label className={`${lab} lg:col-span-2`}>Activity name<input name="name" defaultValue={(a?.name as string) ?? ""} required className={input} /></label>
      <label className={lab}>Connected module
        <select name="moduleSlug" defaultValue={(a?.moduleSlug as string) ?? ""} required className={input}>
          <option value="">— pick module —</option>
          {MODULE_DASHBOARDS.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>
      </label>
      <label className={lab}>Expected return / unit (₹)<input name="expectedValue" type="number" step="0.01" defaultValue={a ? (a.expectedValue as number) / 100 : ""} className={input} /></label>
      <label className={lab}>Expected cost / unit (₹)<input name="expectedCost" type="number" step="0.01" defaultValue={a ? (a.expectedCost as number) / 100 : ""} className={input} /></label>
      <label className={`${lab} flex items-end gap-2 pb-1.5`}><input type="checkbox" name="active" defaultChecked={a ? a.active !== false : true} className="rounded border-slate-300" /> Active</label>
      <label className={`${lab} lg:col-span-6`}>Description<input name="description" defaultValue={(a?.description as string) ?? ""} className={input} /></label>
    </div>
  );
}

/** Activity Create Master: the catalogue of activities used by the reverse plan. */
export default async function ActivityMasterPage() {
  await requireCan("masters", "edit");
  const rows = await prisma.activityMaster.findMany({ orderBy: { name: "asc" } });
  const moduleName = (slug: string) => MODULE_DASHBOARDS.find((m) => m.slug === slug)?.name ?? slug;

  return (
    <div>
      <PageHeader title="Activity master" subtitle="The activity catalogue for reverse planning — each activity is connected to a module with its expected return and cost per unit" />
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link href="/master-plan" className="text-rose-700 hover:underline dark:text-rose-300">← Master plan (vision)</Link>
        <Link href="/master-plan/variance" className="text-rose-700 hover:underline dark:text-rose-300">Variance report →</Link>
      </div>

      <div className="space-y-4">
        {rows.map((a) => (
          <Card key={a.id}>
            <form action={saveActivityMaster}>
              <input type="hidden" name="id" value={a.id} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.name}</span>
                  <Badge tone="blue">{moduleName(a.moduleSlug)}</Badge>
                  <span className="text-xs text-slate-500">return {formatINR(a.expectedValue)} · cost {formatINR(a.expectedCost)} per unit</span>
                  {!a.active && <Badge tone="red">inactive</Badge>}
                </div>
                <SubmitButton>Save</SubmitButton>
              </div>
              <ActivityFields a={a as Record<string, unknown>} />
            </form>
          </Card>
        ))}

        <Card accent>
          <h2 className="mb-3 font-semibold">New catalogue activity</h2>
          <form action={saveActivityMaster}>
            <ActivityFields a={null} />
            <div className="mt-3"><SubmitButton>Create activity</SubmitButton></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
