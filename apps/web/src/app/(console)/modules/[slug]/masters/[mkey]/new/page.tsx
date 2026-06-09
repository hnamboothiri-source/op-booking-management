import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { getModuleBySlug } from "@/lib/modules/registry";
import { getModuleMaster, createCustomRecord } from "@/lib/config/recordActions";
import type { MasterDef } from "@/lib/masters/registry";
import MasterForm from "@/components/MasterForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewCustomRecord({ params }: { params: Promise<{ slug: string; mkey: string }> }) {
  const { slug, mkey } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireUser();
  if (!canConfigureModule(user, slug)) redirect("/forbidden");

  const master = await getModuleMaster(slug, mkey);
  if (!master) notFound();
  const synthetic: MasterDef = { key: master.key, label: master.label, model: "customRecord", fields: master.fields, listColumns: master.listColumns };

  return (
    <div>
      <PageHeader title={`New ${master.label}`} />
      <div className="mb-4"><Link href={`/modules/${slug}/masters/${mkey}`} className="text-sm text-slate-500 hover:underline">← {master.label}</Link></div>
      <MasterForm master={synthetic} action={createCustomRecord.bind(null, slug, mkey)} submitLabel="Create" />
    </div>
  );
}
