import { prisma } from "../db";

export type OutreachEventType = "camp" | "mobile";

export interface OutreachKpis {
  screened: number;
  leads: number;
  consultations: number;
  admissions: number;
  /** Sum of admitted-admission estimatedCost (paise). */
  downstreamRevenue: number;
  /** branchId → { admissions, revenue } */
  byBranch: Record<string, { admissions: number; revenue: number }>;
}

/**
 * Trace a camp / mobile-clinic's downstream value: its screenings' auto-created
 * leads → bookings → consultations → admitted admissions (summing estimatedCost),
 * grouped by the consultation's branch. Mirrors campaigns/metrics.ts but avoids
 * relation-filter `where`s so it works against the mock client too.
 */
export async function computeOutreachKpis(eventType: OutreachEventType, id: string): Promise<OutreachKpis> {
  const screenings =
    eventType === "camp"
      ? await prisma.campPatient.findMany({ where: { campId: id }, select: { leadId: true } })
      : await prisma.mobileClinicPatient.findMany({ where: { mobileClinicId: id }, select: { leadId: true } });

  const screened = screenings.length;
  const leadIds = screenings.map((s) => s.leadId).filter((x): x is string => !!x);
  const empty: OutreachKpis = { screened, leads: leadIds.length, consultations: 0, admissions: 0, downstreamRevenue: 0, byBranch: {} };
  if (leadIds.length === 0) return empty;

  const bookings = await prisma.opBooking.findMany({ where: { leadId: { in: leadIds } }, select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);
  if (bookingIds.length === 0) return empty;

  const consults = await prisma.consultation.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true, branchId: true } });
  const branchOf = new Map(consults.map((c) => [c.id, c.branchId ?? "unassigned"]));
  const consultationIds = consults.map((c) => c.id);
  if (consultationIds.length === 0) return { ...empty, consultations: 0 };

  const recs = await prisma.admissionRecommendation.findMany({
    where: { status: "admitted", consultationId: { in: consultationIds } },
    select: { consultationId: true, estimatedCost: true },
  });

  const byBranch: Record<string, { admissions: number; revenue: number }> = {};
  let downstreamRevenue = 0;
  for (const r of recs) {
    const branch = branchOf.get(r.consultationId ?? "") ?? "unassigned";
    const cost = r.estimatedCost ?? 0;
    downstreamRevenue += cost;
    const g = (byBranch[branch] ??= { admissions: 0, revenue: 0 });
    g.admissions += 1;
    g.revenue += cost;
  }

  return { screened, leads: leadIds.length, consultations: consults.length, admissions: recs.length, downstreamRevenue, byBranch };
}
