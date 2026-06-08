import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton } from "@/components/ui";
import { PatientTimeline } from "@/components/PatientTimeline";
import { mockPatientTimeline } from "@/lib/patients/timeline-mock";

export const dynamic = "force-dynamic";

export default async function PatientTimelinePage({ params }: { params: Promise<{ mrd: string }> }) {
  const { mrd: raw } = await params;
  const mrd = decodeURIComponent(raw);
  await requireCan("patients", "view");

  // Best-effort name for the header; the timeline feed itself is still mock
  // data during the frontend phase (see timeline-mock.ts).
  const patient = await prisma.patient.findUnique({ where: { mrd }, select: { name: true } });

  const events = mockPatientTimeline();

  return (
    <div>
      <PageHeader
        title={`${patient?.name ?? mrd} · Timeline`}
        subtitle={`${mrd} · all activity, newest first`}
        action={<LinkButton href={`/patients/${encodeURIComponent(mrd)}`} tone="ghost">← Profile</LinkButton>}
      />
      <div className="mb-6">
        <Link href="/patients" className="text-sm text-slate-500 hover:underline">← Patients</Link>
      </div>

      <p className="mb-5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Showing sample data — the timeline is not yet wired to the database.
      </p>

      <PatientTimeline events={events} />
    </div>
  );
}
