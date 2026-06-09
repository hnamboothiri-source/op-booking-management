import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { getModuleBySlug } from "@/lib/modules/registry";
import { listModuleMasters, deleteModuleMaster } from "@/lib/config/recordActions";
import { PageHeader, Card, LinkButton, SubmitButton, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModuleMastersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireUser();
  const canConfig = canConfigureModule(user, slug);

  const masters = await listModuleMasters(slug);

  return (
    <div>
      <PageHeader
        title={`Masters · ${def.name}`}
        subtitle="Department-specific master lists with custom columns"
        action={canConfig ? <LinkButton href={`/modules/${slug}/masters/new`}>+ New master</LinkButton> : undefined}
      />
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/modules/${slug}`} className="text-sm text-slate-500 hover:underline">← {def.name} dashboard</Link>
        {canConfig && <Link href={`/modules/${slug}/configure`} className="text-sm text-rose-600 hover:underline">Configure →</Link>}
      </div>

      {masters.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No masters defined for this module yet.{canConfig && " Create one to capture department-specific lists."}</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {masters.map((m) => (
            <Card key={m.id}>
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/modules/${slug}/masters/${m.key}`} className="font-semibold hover:underline">{m.label}</Link>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-400">{m.key}</div>
                </div>
                {!m.active && <Badge tone="red">inactive</Badge>}
              </div>
              <div className="mt-2 text-xs text-slate-500">{m.fields.length} column{m.fields.length === 1 ? "" : "s"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <LinkButton href={`/modules/${slug}/masters/${m.key}`} tone="ghost">Records</LinkButton>
                {canConfig && <LinkButton href={`/modules/${slug}/masters/${m.key}/edit`} tone="ghost">Columns</LinkButton>}
                {canConfig && (
                  <form action={deleteModuleMaster.bind(null, slug, m.id)}>
                    <SubmitButton tone="danger">Delete</SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
