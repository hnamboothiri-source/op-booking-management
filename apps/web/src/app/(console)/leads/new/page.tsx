import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { approvedActivities } from "@/lib/planning/gate";
import { LeadForm } from "./LeadForm";

export const dynamic = "force-dynamic";

export default async function NewLead() {
  await requireCan("leads", "create");
  const [sources, campaigns, diseases, branches, staff] = await Promise.all([
    prisma.leadSourceMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const planRefs = await approvedActivities("leads", "generate_leads");

  const pick = (rows: { id: string; name: string; group?: string | null }[]) => rows.map((r) => ({ id: r.id, name: r.name, group: r.group ?? null }));

  return (
    <div>
      <PageHeader title="New lead" subtitle="Capture an enquiry (Module 1)" />
      <div className="mb-4"><Link href="/leads" className="text-sm text-slate-500 hover:underline">← Leads</Link></div>
      <LeadForm sources={pick(sources)} campaigns={pick(campaigns)} diseases={pick(diseases)} branches={pick(branches)} staff={pick(staff)} planRefs={planRefs} />
    </div>
  );
}
