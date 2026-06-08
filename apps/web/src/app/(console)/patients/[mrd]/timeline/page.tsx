import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton } from "@/components/ui";
import { PatientTimeline } from "@/components/PatientTimeline";
import { mockPatientTimeline } from "@/lib/patients/timeline-mock";
import type { TimelineKind } from "@prm/core";

export const dynamic = "force-dynamic";

const KINDS = ["booking", "consultation", "call", "lead", "follow_up", "communication", "admission", "referral", "waitlist", "document"];

export default async function PatientTimelinePage({ params, searchParams }: { params: Promise<{ mrd: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { mrd: raw } = await params;
  const mrd = decodeURIComponent(raw);
  const { kind } = await searchParams;
  await requireCan("patients", "view");

  // Best-effort name for the header; the timeline feed itself is still mock
  // data during the frontend phase (see timeline-mock.ts).
  const patient = await prisma.patient.findUnique({ where: { mrd }, select: { name: true } });

  const events = mockPatientTimeline();
  const initialKind = kind && KINDS.includes(kind) ? (kind as TimelineKind) : undefined;

  return (
    <div>
      <PageHeader
        title={`${patient?.name ?? mrd} · Timeline`}
        subtitle={`${mrd} · all activity, newest first`}
        action={<LinkButton href={`/patients/${encodeURIComponent(mrd)}`} tone="ghost">← Profile</LinkButton>}
      />
      <div className="mb-6">
        <Link href="/patients" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Patients</Link>
      </div>

      <p className="mb-5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Showing sample data — the timeline is not yet wired to the database.
      </p>

      <PatientTimeline events={events} initialKind={initialKind} />
    </div>
  );
}
