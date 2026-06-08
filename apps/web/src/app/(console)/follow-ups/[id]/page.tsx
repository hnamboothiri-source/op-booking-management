import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionFollowUp } from "@/lib/followups/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FollowUpDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("follow_ups", "view");
  const f = await prisma.followUp.findUnique({ where: { id }, include: { patient: true, doctor: true } });
  if (!f) notFound();
  const canEdit = can(user.role, "follow_ups", "edit");

  return (
    <div>
      <PageHeader title="Follow-up" subtitle={`${f.patient?.name ?? f.patientMrd} · ${f.type.replace(/_/g, " ")}`} action={<Badge tone={f.status === "done" ? "green" : f.status === "missed" ? "red" : "blue"}>{f.status}</Badge>} />
      <div className="mb-6"><Link href="/follow-ups" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Follow-ups</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Patient</div><div className="font-medium"><Link href={`/patients/${encodeURIComponent(f.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{f.patient?.name ?? f.patientMrd}</Link></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Type</div><div className="font-medium">{f.type.replace(/_/g, " ")}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Due</div><div className="font-medium">{f.dueDate.toISOString().slice(0, 10)}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Doctor</div><div className="font-medium">{f.doctor?.name ?? "—"}</div></Card>
      </div>

      {canEdit && f.status !== "done" && (
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/appointments/book?mrd=${encodeURIComponent(f.patientMrd)}`}>Book appointment</LinkButton>
          <form action={transitionFollowUp.bind(null, f.id, "done")}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark done</button></form>
          <form action={transitionFollowUp.bind(null, f.id, "missed")}><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark missed</button></form>
        </div>
      )}
    </div>
  );
}
