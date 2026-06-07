import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { getMaster } from "@/lib/masters/registry";
import { getRow, updateRow } from "@/lib/masters/actions";
import MasterForm from "@/components/MasterForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditMaster({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params;
  const master = getMaster(entity);
  if (!master || master.managedInModule) notFound();
  await requireCan("masters", "edit");

  const row = await getRow(entity, id);
  if (!row) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${master.label}`} />
      <div className="mb-4">
        <Link href={`/masters/${entity}`} className="text-sm text-slate-500 hover:underline">← Back to {master.label}</Link>
      </div>
      <MasterForm master={master} row={row} action={updateRow.bind(null, entity, id)} submitLabel="Save changes" />
    </div>
  );
}
