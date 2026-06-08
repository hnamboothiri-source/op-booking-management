import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deskLabel } from "@prm/core";
import { PageHeader } from "@/components/ui";
import CallForm, { type ChecklistItem } from "@/components/callcenter/CallForm";

export const dynamic = "force-dynamic";

export default async function FollowUpCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCan("calls", "create");
  const fu = await prisma.followUp.findUnique({ where: { id }, include: { patient: true } });
  if (!fu) notFound();
  const desk = "front_office";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = await prisma.callChecklistItem.findMany({ where: { active: true, desk: { in: [desk, "any"] } } as any, orderBy: { sortOrder: "asc" } }) as unknown as ChecklistItem[];

  return (
    <div>
      <PageHeader title={`Review call — ${fu.patient?.name ?? fu.patientMrd}`} subtitle={`${deskLabel(desk)} · ${fu.type.replace(/_/g, " ")}`} />
      <div className="mb-6"><Link href={`/follow-ups/${id}`} className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Back to follow-up</Link></div>
      <CallForm items={items} desk={desk} patientMrd={fu.patientMrd} followUpId={id} followUpMode />
    </div>
  );
}
