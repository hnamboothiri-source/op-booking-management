import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton } from "@/components/ui";
import { PatientTimeline } from "@/components/PatientTimeline";
import { mockPatientTimeline } from "@/lib/patients/timeline-mock";
import { buildPatientTimeline, THERAPY_TYPE_LABELS, type TimelineKind, type TherapyType } from "@prm/core";

export const dynamic = "force-dynamic";

const KINDS = ["booking", "consultation", "call", "lead", "follow_up", "communication", "admission", "referral", "waitlist", "document", "medicine", "therapy"];

export default async function PatientTimelinePage({ params, searchParams }: { params: Promise<{ mrd: string }>; searchParams: Promise<{ kind?: string }> }) {
  const { mrd: raw } = await params;
  const mrd = decodeURIComponent(raw);
  const { kind } = await searchParams;
  await requireCan("patients", "view");

  // Header name + the real Ayurveda-engagement events (medicine + therapy) are
  // live from the store; the rest of the feed is still sample data.
  const [patient, courses, sessions, plans] = await Promise.all([
    prisma.patient.findUnique({ where: { mrd }, select: { name: true } }),
    prisma.medicationCourse.findMany({ where: { patientMrd: mrd } }),
    prisma.therapySession.findMany({ where: { patientMrd: mrd } }),
    prisma.therapyPlan.findMany({ where: { patientMrd: mrd } }),
  ]);
  const planType = new Map(plans.map((p) => [p.id, p.therapyType as TherapyType]));

  const realEvents = buildPatientTimeline({
    medicationCourses: courses.map((c) => ({ id: c.id, createdAt: c.createdAt, medicine: c.medicine, durationDays: c.durationDays })),
    therapySessions: sessions.map((s) => ({
      id: s.id, sessionNo: s.sessionNo, scheduledDate: s.scheduledDate, completedAt: s.completedAt,
      status: s.status, therapyLabel: THERAPY_TYPE_LABELS[planType.get(s.planId) ?? "panchakarma"] ?? "Therapy",
    })),
  });
  // Merge live engagement events with the sample feed, newest first.
  const events = [...realEvents, ...mockPatientTimeline()].sort((a, b) => b.at.getTime() - a.at.getTime());
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
