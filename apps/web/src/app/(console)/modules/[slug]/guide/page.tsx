import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { getModuleBySlug } from "@/lib/modules/registry";
import { getModuleFlow } from "@/lib/config/actions";
import { resolveFlow } from "@/lib/modules/flow";
import { PageHeader, Card } from "@/components/ui";
import { FlowMap } from "@/components/modules/FlowMap";

export const dynamic = "force-dynamic";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireCan(def.resource, "view");
  const { steps: resolved, readiness } = await resolveFlow(def, await getModuleFlow(slug), user);

  return (
    <div>
      <PageHeader title={`Guide · ${def.name}`} subtitle={`How to work this department, start to result — ${def.subtitle}`} />
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/modules/${slug}`} className="text-sm text-slate-500 hover:underline">← {def.name} dashboard</Link>
        {canConfigureModule(user, slug) && <Link href={`/modules/${slug}/configure`} className="text-sm text-rose-600 hover:underline">Edit this flow →</Link>}
      </div>

      {resolved.length > 0
        ? <FlowMap steps={resolved} readiness={readiness} variant="full" />
        : <Card><p className="text-sm text-slate-500">No flow defined for this module yet.</p></Card>}
    </div>
  );
}
