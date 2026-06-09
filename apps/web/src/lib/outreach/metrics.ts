import { OUTREACH_FUNNEL_LABELS } from "@prm/core";
import type { FunnelStage } from "@/components/charts/LeadFunnelChart";
import { prisma } from "../db";

export type OutreachEventType = "camp" | "mobile";

export interface OutreachKpis {
  screened: number;
  recommended: number;
  leads: number;
  appointments: number;
  consultations: number;
  treatments: number;
  admissions: number;
  /** Sum of admitted-admission estimatedCost (paise). */
  downstreamRevenue: number;
  /** branchId → { admissions, revenue } */
  byBranch: Record<string, { admissions: number; revenue: number }>;
}

const emptyKpis = (screened = 0, recommended = 0, leads = 0): OutreachKpis => ({
  screened, recommended, leads, appointments: 0, consultations: 0, treatments: 0, admissions: 0, downstreamRevenue: 0, byBranch: {},
});

/**
 * Trace one event's downstream value: its screenings' auto-created leads →
 * bookings → consultations → treatment plans → admitted admissions (summing
 * estimatedCost), grouped by the consultation's branch. Mock-safe (no
 * relation-filter wheres).
 */
export async function computeOutreachKpis(eventType: OutreachEventType, id: string): Promise<OutreachKpis> {
  const screenings =
    eventType === "camp"
      ? await prisma.campPatient.findMany({ where: { campId: id }, select: { leadId: true, recommendedVisit: true } })
      : await prisma.mobileClinicPatient.findMany({ where: { mobileClinicId: id }, select: { leadId: true, referredToBranch: true } });

  const screened = screenings.length;
  const recommended = screenings.filter((s) => ("recommendedVisit" in s ? s.recommendedVisit : (s as { referredToBranch?: boolean }).referredToBranch)).length;
  const leadIds = screenings.map((s) => s.leadId).filter((x): x is string => !!x);
  if (leadIds.length === 0) return emptyKpis(screened, recommended, 0);

  const bookings = await prisma.opBooking.findMany({ where: { leadId: { in: leadIds } }, select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);
  if (bookingIds.length === 0) return emptyKpis(screened, recommended, leadIds.length);

  const consults = await prisma.consultation.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true, branchId: true } });
  const branchOf = new Map(consults.map((c) => [c.id, c.branchId ?? "unassigned"]));
  const consultationIds = consults.map((c) => c.id);
  const base = { ...emptyKpis(screened, recommended, leadIds.length), appointments: bookings.length, consultations: consults.length };
  if (consultationIds.length === 0) return base;

  const [plans, recs] = await Promise.all([
    prisma.treatmentPlan.findMany({ where: { consultationId: { in: consultationIds } }, select: { consultationId: true } }),
    prisma.admissionRecommendation.findMany({ where: { status: "admitted", consultationId: { in: consultationIds } }, select: { consultationId: true, estimatedCost: true } }),
  ]);

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
  return { ...base, treatments: new Set(plans.map((p) => p.consultationId)).size, admissions: recs.length, downstreamRevenue, byBranch };
}

/** Per-event acquisition funnel for LeadFunnelChart. */
export function outreachFunnel(k: OutreachKpis): FunnelStage[] {
  return [
    { label: OUTREACH_FUNNEL_LABELS.screened, value: k.screened },
    { label: OUTREACH_FUNNEL_LABELS.recommended, value: k.recommended },
    { label: OUTREACH_FUNNEL_LABELS.appointment, value: k.appointments },
    { label: OUTREACH_FUNNEL_LABELS.consultation, value: k.consultations },
    { label: OUTREACH_FUNNEL_LABELS.treatment, value: k.treatments },
    { label: OUTREACH_FUNNEL_LABELS.admission, value: k.admissions },
  ];
}

// ---------------------------------------------------------------------------
// Unified outreach analytics (the /outreach dashboard) — one efficient pass.
// ---------------------------------------------------------------------------

export interface FunnelCounts {
  screened: number; recommended: number; appointments: number; consultations: number; treatments: number; admissions: number; revenue: number;
}
const zero = (): FunnelCounts => ({ screened: 0, recommended: 0, appointments: 0, consultations: 0, treatments: 0, admissions: 0, revenue: 0 });

export interface OutreachAnalytics {
  totals: FunnelCounts & { camps: number; mobiles: number; leads: number };
  funnelCamp: FunnelStage[];
  funnelMobile: FunnelStage[];
  byType: { type: "Camp" | "Mobile clinic"; counts: FunnelCounts }[];
  byLocation: { key: string; counts: FunnelCounts }[];
  byDistrict: { key: string; counts: FunnelCounts }[];
  byStaff: { id: string; name: string; counts: FunnelCounts }[];
}

const funnelOf = (c: FunnelCounts): FunnelStage[] => [
  { label: OUTREACH_FUNNEL_LABELS.screened, value: c.screened },
  { label: OUTREACH_FUNNEL_LABELS.recommended, value: c.recommended },
  { label: OUTREACH_FUNNEL_LABELS.appointment, value: c.appointments },
  { label: OUTREACH_FUNNEL_LABELS.consultation, value: c.consultations },
  { label: OUTREACH_FUNNEL_LABELS.treatment, value: c.treatments },
  { label: OUTREACH_FUNNEL_LABELS.admission, value: c.admissions },
];

/** Aggregate camp + mobile acquisition funnels across type, location, district and screening staff. */
export async function outreachAnalytics(): Promise<OutreachAnalytics> {
  const [camps, mobiles, campPatients, mobilePatients, staff] = await Promise.all([
    prisma.camp.findMany({ select: { id: true, location: true, district: true } }),
    prisma.mobileClinic.findMany({ select: { id: true, location: true, district: true } }),
    prisma.campPatient.findMany({ select: { campId: true, leadId: true, screenedById: true, recommendedVisit: true } }),
    prisma.mobileClinicPatient.findMany({ select: { mobileClinicId: true, leadId: true, screenedById: true, referredToBranch: true } }),
    prisma.staffUser.findMany({ select: { id: true, name: true } }),
  ]);
  const campGeo = new Map(camps.map((c) => [c.id, { location: c.location ?? "—", district: c.district ?? "—" }]));
  const mobileGeo = new Map(mobiles.map((m) => [m.id, { location: m.location ?? "—", district: m.district ?? "—" }]));
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  interface Screening { type: "Camp" | "Mobile clinic"; location: string; district: string; leadId: string | null; screenedById: string | null; recommended: boolean }
  const screenings: Screening[] = [
    ...campPatients.map((p) => { const g = campGeo.get(p.campId) ?? { location: "—", district: "—" }; return { type: "Camp" as const, location: g.location, district: g.district, leadId: p.leadId, screenedById: p.screenedById, recommended: !!p.recommendedVisit }; }),
    ...mobilePatients.map((p) => { const g = mobileGeo.get(p.mobileClinicId) ?? { location: "—", district: "—" }; return { type: "Mobile clinic" as const, location: g.location, district: g.district, leadId: p.leadId, screenedById: p.screenedById, recommended: !!p.referredToBranch }; }),
  ];

  // One downstream pass over all leads.
  const leadIds = screenings.map((s) => s.leadId).filter((x): x is string => !!x);
  const bookings = leadIds.length ? await prisma.opBooking.findMany({ where: { leadId: { in: leadIds } }, select: { id: true, leadId: true } }) : [];
  const bookingsByLead = new Map<string, string[]>();
  for (const b of bookings) if (b.leadId) (bookingsByLead.get(b.leadId) ?? bookingsByLead.set(b.leadId, []).get(b.leadId)!).push(b.id);
  const bookingIds = bookings.map((b) => b.id);
  const consults = bookingIds.length ? await prisma.consultation.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true, bookingId: true } }) : [];
  const consultByBooking = new Map(consults.map((c) => [c.bookingId, c.id]));
  const consultIds = consults.map((c) => c.id);
  const [plans, recs] = await Promise.all([
    consultIds.length ? prisma.treatmentPlan.findMany({ where: { consultationId: { in: consultIds } }, select: { consultationId: true } }) : Promise.resolve([] as { consultationId: string }[]),
    consultIds.length ? prisma.admissionRecommendation.findMany({ where: { status: "admitted", consultationId: { in: consultIds } }, select: { consultationId: true, estimatedCost: true } }) : Promise.resolve([] as { consultationId: string | null; estimatedCost: number | null }[]),
  ]);
  const treatmentSet = new Set(plans.map((p) => p.consultationId));
  const admitCost = new Map<string, number>();
  for (const r of recs) if (r.consultationId) admitCost.set(r.consultationId, (admitCost.get(r.consultationId) ?? 0) + (r.estimatedCost ?? 0));

  const add = (m: Map<string, FunnelCounts>, key: string, fn: (c: FunnelCounts) => void) => { const c = m.get(key) ?? zero(); fn(c); m.set(key, c); };
  const byTypeM = new Map<string, FunnelCounts>();
  const byLoc = new Map<string, FunnelCounts>();
  const byDist = new Map<string, FunnelCounts>();
  const byStaffM = new Map<string, FunnelCounts>();
  const totals = zero();

  for (const s of screenings) {
    // Resolve this screening's downstream.
    const bIds = s.leadId ? bookingsByLead.get(s.leadId) ?? [] : [];
    const cIds = bIds.map((b) => consultByBooking.get(b)).filter((x): x is string => !!x);
    const hasAppt = bIds.length > 0;
    const hasConsult = cIds.length > 0;
    const hasTreatment = cIds.some((c) => treatmentSet.has(c));
    const revenue = cIds.reduce((sum, c) => sum + (admitCost.get(c) ?? 0), 0);
    const hasAdmit = cIds.some((c) => admitCost.has(c));
    const apply = (c: FunnelCounts) => {
      c.screened += 1;
      if (s.recommended) c.recommended += 1;
      if (hasAppt) c.appointments += 1;
      if (hasConsult) c.consultations += 1;
      if (hasTreatment) c.treatments += 1;
      if (hasAdmit) c.admissions += 1;
      c.revenue += revenue;
    };
    apply(totals);
    add(byTypeM, s.type, apply);
    add(byLoc, s.location, apply);
    add(byDist, s.district, apply);
    if (s.screenedById) add(byStaffM, s.screenedById, apply);
  }

  const sortByRevenue = (m: Map<string, FunnelCounts>) => [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].screened - a[1].screened);
  return {
    totals: { ...totals, camps: camps.length, mobiles: mobiles.length, leads: leadIds.length },
    funnelCamp: funnelOf(byTypeM.get("Camp") ?? zero()),
    funnelMobile: funnelOf(byTypeM.get("Mobile clinic") ?? zero()),
    byType: (["Camp", "Mobile clinic"] as const).map((t) => ({ type: t, counts: byTypeM.get(t) ?? zero() })),
    byLocation: sortByRevenue(byLoc).map(([key, counts]) => ({ key, counts })),
    byDistrict: sortByRevenue(byDist).map(([key, counts]) => ({ key, counts })),
    byStaff: sortByRevenue(byStaffM).map(([id, counts]) => ({ id, name: staffName.get(id) ?? id, counts })),
  };
}
