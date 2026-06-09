import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { getModuleBySlug } from "@/lib/modules/registry";
import { getModuleMaster, listCustomRecords, deleteCustomRecord } from "@/lib/config/recordActions";
import { PageHeader, LinkButton, SubmitButton } from "@/components/ui";
import { renderCell } from "@/components/masters/renderCell";

export const dynamic = "force-dynamic";

export default async function CustomRecordList({ params }: { params: Promise<{ slug: string; mkey: string }> }) {
  const { slug, mkey } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireUser();
  const canConfig = canConfigureModule(user, slug);

  const master = await getModuleMaster(slug, mkey);
  if (!master) notFound();
  const rows = await listCustomRecords(slug, mkey);
  const cols = master.listColumns.length ? master.listColumns : master.fields.map((f) => f.name);

  return (
    <div>
      <PageHeader
        title={master.label}
        subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
        action={canConfig ? <LinkButton href={`/modules/${slug}/masters/${mkey}/new`}>+ New</LinkButton> : undefined}
      />
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/modules/${slug}/masters`} className="text-sm text-slate-500 hover:underline">← Masters</Link>
        {canConfig && <Link href={`/modules/${slug}/masters/${mkey}/edit`} className="text-sm text-rose-600 hover:underline">Edit columns →</Link>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {cols.map((c) => <th key={c} className="px-4 py-2 font-medium">{c.replace(/_/g, " ")}</th>)}
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-4 py-6 text-center text-slate-400">No records yet.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100">
                {cols.map((c) => <td key={c} className="px-4 py-2">{renderCell(row[c], c)}</td>)}
                <td className="px-4 py-2 text-right">
                  {canConfig && (
                    <div className="flex justify-end gap-2">
                      <LinkButton href={`/modules/${slug}/masters/${mkey}/${row.id}`} tone="ghost">Edit</LinkButton>
                      <form action={deleteCustomRecord.bind(null, slug, mkey, String(row.id))}>
                        <SubmitButton tone="danger">Delete</SubmitButton>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
