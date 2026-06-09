import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { getModuleBySlug } from "@/lib/modules/registry";
import { getModuleMaster, addMasterField, removeMasterField } from "@/lib/config/recordActions";
import { PageHeader } from "@/components/ui";
import { FieldBuilder } from "@/components/config/FieldBuilder";

export const dynamic = "force-dynamic";

export default async function EditModuleMasterColumns({ params }: { params: Promise<{ slug: string; mkey: string }> }) {
  const { slug, mkey } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireUser();
  if (!canConfigureModule(user, slug)) redirect("/forbidden");

  const master = await getModuleMaster(slug, mkey);
  if (!master) notFound();

  return (
    <div>
      <PageHeader title={`Columns · ${master.label}`} subtitle={`Define the fields captured for each ${master.label} record`} />
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/modules/${slug}/masters`} className="text-sm text-slate-500 hover:underline">← Masters</Link>
        <Link href={`/modules/${slug}/masters/${mkey}`} className="text-sm text-rose-600 hover:underline">View records →</Link>
      </div>
      <FieldBuilder
        title={`${master.label} columns`}
        hint="Each column becomes a field on the record form and a column on the list."
        fields={master.fields}
        addAction={addMasterField.bind(null, slug, master.id)}
        removeAction={removeMasterField.bind(null, slug, master.id)}
      />
    </div>
  );
}
