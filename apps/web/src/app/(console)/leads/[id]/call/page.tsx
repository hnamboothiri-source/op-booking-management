import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deskLabel } from "@prm/core";
import { PageHeader } from "@/components/ui";
import CallForm, { type ChecklistItem } from "@/components/callcenter/CallForm";

export const dynamic = "force-dynamic";

export default async function LeadCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCan("calls", "create");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) notFound();
  const desk = (lead.desk as string) ?? "back_office";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = await prisma.callChecklistItem.findMany({ where: { active: true, desk: { in: [desk, "any"] } } as any, orderBy: { sortOrder: "asc" } }) as unknown as ChecklistItem[];

  return (
    <div>
      <PageHeader title={`Call — ${lead.contactName}`} subtitle={`${deskLabel(desk)} · ${lead.phone}`} />
      <div className="mb-6"><Link href={`/leads/${id}`} className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Back to lead</Link></div>
      <CallForm items={items} desk={desk} leadId={id} />
    </div>
  );
}
