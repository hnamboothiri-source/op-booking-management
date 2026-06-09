import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { getModuleBySlug } from "@/lib/modules/registry";
import { ModuleDashboard } from "@/components/modules/ModuleDashboard";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireCan(def.resource, "view");
  return <ModuleDashboard def={def} user={user} />;
}
