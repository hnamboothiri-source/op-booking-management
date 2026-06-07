import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { getMaster } from "@/lib/masters/registry";
import { createRow } from "@/lib/masters/actions";
import MasterForm from "@/components/MasterForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewMaster({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const master = getMaster(entity);
  if (!master || master.managedInModule) notFound();
  await requireCan("masters", "create");

  return (
    <div>
      <PageHeader title={`New ${master.label}`} />
      <div className="mb-4">
        <Link href={`/masters/${entity}`} className="text-sm text-slate-500 hover:underline">← Back to {master.label}</Link>
      </div>
      <MasterForm master={master} action={createRow.bind(null, entity)} submitLabel="Create" />
    </div>
  );
}
