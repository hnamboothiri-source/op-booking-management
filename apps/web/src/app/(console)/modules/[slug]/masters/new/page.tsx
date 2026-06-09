import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { getModuleBySlug } from "@/lib/modules/registry";
import { createModuleMaster } from "@/lib/config/recordActions";
import { PageHeader, Card, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";

export default async function NewModuleMaster({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireUser();
  if (!canConfigureModule(user, slug)) redirect("/forbidden");

  return (
    <div>
      <PageHeader title={`New master · ${def.name}`} subtitle="Name the list; add its columns on the next step" />
      <div className="mb-4"><Link href={`/modules/${slug}/masters`} className="text-sm text-slate-500 hover:underline">← Masters</Link></div>
      <Card>
        <form action={createModuleMaster.bind(null, slug)} className="max-w-md space-y-3">
          <label className={`${lab} block`}>Label
            <input name="label" required placeholder="Clinic Venue" className={input} />
          </label>
          <label className={`${lab} block`}>Key <span className="text-slate-400">(optional — used in the URL; auto-generated from the label if blank)</span>
            <input name="key" placeholder="clinic-venues" className={input} />
          </label>
          <SubmitButton>Create &amp; add columns</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
