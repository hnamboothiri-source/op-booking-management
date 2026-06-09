import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { getMaster } from "@/lib/masters/registry";
import { listRows, deleteRow } from "@/lib/masters/actions";
import { PageHeader, LinkButton, SubmitButton } from "@/components/ui";
import { renderCell } from "@/components/masters/renderCell";

export const dynamic = "force-dynamic";

export default async function MasterList({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const master = getMaster(entity);
  if (!master || master.managedInModule) notFound();
  await requireCan("masters", "view");

  const rows = await listRows(entity);

  return (
    <div>
      <PageHeader
        title={master.label}
        subtitle={`${rows.length} record${rows.length === 1 ? "" : "s"}`}
        action={<LinkButton href={`/masters/${entity}/new`}>+ New</LinkButton>}
      />
      <div className="mb-4">
        <Link href="/masters" className="text-sm text-slate-500 hover:underline">← All master data</Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {master.listColumns.map((c) => <th key={c} className="px-4 py-2 font-medium">{c.replace(/_/g, " ")}</th>)}
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={master.listColumns.length + 1} className="px-4 py-6 text-center text-slate-400">No records yet.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100">
                {master.listColumns.map((c) => <td key={c} className="px-4 py-2">{renderCell(row[c], c)}</td>)}
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <LinkButton href={`/masters/${entity}/${row.id}`} tone="ghost">Edit</LinkButton>
                    <form action={deleteRow.bind(null, entity, String(row.id))}>
                      <SubmitButton tone="danger">Delete</SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
