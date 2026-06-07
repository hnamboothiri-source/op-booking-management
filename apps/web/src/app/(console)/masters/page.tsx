import Link from "next/link";
import { requireCan } from "@/lib/session";
import { MASTERS } from "@/lib/masters/registry";
import { PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MastersIndex() {
  await requireCan("masters", "view");
  return (
    <div>
      <PageHeader title="Master Data" subtitle={`${MASTERS.length} master sets (administrator only)`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MASTERS.map((m) =>
          m.managedInModule ? (
            <div key={m.key} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="font-semibold text-slate-600">{m.label}</div>
              <p className="mt-1 text-xs text-slate-500">{m.managedInModule}</p>
            </div>
          ) : (
            <Link key={m.key} href={`/masters/${m.key}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{m.label}</span>
                <Badge tone="blue">{m.fields.length} fields</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">Manage {m.label.toLowerCase()} records</p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
