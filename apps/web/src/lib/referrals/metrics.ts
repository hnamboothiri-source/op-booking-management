import { referralScore, REFERRER_TYPE_LABELS, type ReferrerType } from "@prm/core";
import type { FunnelStage } from "@/components/charts/LeadFunnelChart";
import { prisma } from "../db";

export interface ReferralTrace {
  appointments: number;
  consultations: number;
  treatments: number;
  admissions: number;
  revenue: number; // paise (sum of admitted-admission estimatedCost)
}
const EMPTY: ReferralTrace = { appointments: 0, consultations: 0, treatments: 0, admissions: 0, revenue: 0 };

/**
 * Trace one referral's downstream value: referred lead/patient → bookings →
 * consultations → treatment plans → admitted admissions (summing estimatedCost).
 * Mirrors outreach/metrics.ts (no relation-filter wheres → mock-safe). Prefers
 * the lead chain; else the referred patient's bookings on/after the referral date
 * (so pre-existing care isn't credited).
 */
export async function traceReferral(ref: { referredPatientMrd: string | null; referredLeadId: string | null; createdAt: Date }): Promise<ReferralTrace> {
  let bookings: { id: string }[] = [];
  if (ref.referredLeadId) {
    bookings = await prisma.opBooking.findMany({ where: { leadId: ref.referredLeadId }, select: { id: true } });
  } else if (ref.referredPatientMrd) {
    bookings = await prisma.opBooking.findMany({ where: { patientMrd: ref.referredPatientMrd, bookedAt: { gte: ref.createdAt } }, select: { id: true } });
  }
  if (bookings.length === 0) return { ...EMPTY };

  const bookingIds = bookings.map((b) => b.id);
  const consults = await prisma.consultation.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true } });
  if (consults.length === 0) return { ...EMPTY, appointments: bookings.length };

  const consultationIds = consults.map((c) => c.id);
  const [plans, recs] = await Promise.all([
    prisma.treatmentPlan.findMany({ where: { consultationId: { in: consultationIds } }, select: { consultationId: true } }),
    prisma.admissionRecommendation.findMany({ where: { status: "admitted", consultationId: { in: consultationIds } }, select: { estimatedCost: true } }),
  ]);
  const revenue = recs.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
  return { appointments: bookings.length, consultations: consults.length, treatments: new Set(plans.map((p) => p.consultationId)).size, admissions: recs.length, revenue };
}

export interface ReferrerKpis extends ReferralTrace {
  referrals: number;
  converted: number;
  score: number;
  factors: Record<string, number>;
}

/** Aggregate a referrer's KPIs across all their referrals + compute the score. */
export async function referrerKpis(referrerId: string): Promise<ReferrerKpis> {
  const refs = await prisma.referral.findMany({ where: { referrerId } });
  const traces = await Promise.all(refs.map((r) => traceReferral(r)));
  const sum = traces.reduce((a, t) => ({
    appointments: a.appointments + t.appointments,
    consultations: a.consultations + t.consultations,
    treatments: a.treatments + t.treatments,
    admissions: a.admissions + t.admissions,
    revenue: a.revenue + t.revenue,
  }), { ...EMPTY });
  const converted = refs.filter((r) => r.status === "consulted" || r.status === "admitted").length;
  const { score, factors } = referralScore({ referralCount: refs.length, convertedCount: converted, attributedRevenue: sum.revenue });
  return { ...sum, referrals: refs.length, converted, score, factors };
}

/** Referral funnel for the performance dashboard (received → … → admission). */
export async function referralFunnel(filters: { type?: string } = {}): Promise<FunnelStage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = filters.type ? { type: filters.type } : {};
  const refs = await prisma.referral.findMany({ where });
  const traces = await Promise.all(refs.map((r) => traceReferral(r)));
  const sum = traces.reduce((a, t) => ({
    appointments: a.appointments + (t.appointments > 0 ? 1 : 0),
    consultations: a.consultations + (t.consultations > 0 ? 1 : 0),
    treatments: a.treatments + (t.treatments > 0 ? 1 : 0),
    admissions: a.admissions + (t.admissions > 0 ? 1 : 0),
  }), { appointments: 0, consultations: 0, treatments: 0, admissions: 0 });
  return [
    { label: "Referrals received", value: refs.length, entity: "referrals", filters: {} },
    { label: "Reached appointment", value: sum.appointments },
    { label: "Consulted", value: sum.consultations, entity: "referrals", filters: { status: "consulted,admitted" } },
    { label: "Treatment started", value: sum.treatments },
    { label: "Admitted", value: sum.admissions, entity: "referrals", filters: { status: "admitted" } },
  ];
}

export interface TopReferrerRow {
  id: string;
  name: string;
  type: ReferrerType;
  referrals: number;
  admissions: number;
  revenue: number;
  score: number;
}

/** Ranked referrers (by score desc), optionally filtered by type. */
export async function topReferrers(type?: string, take = 10): Promise<TopReferrerRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { active: true, ...(type ? { type } : {}) };
  const referrers = await prisma.referrer.findMany({ where });
  const rows = await Promise.all(referrers.map(async (r) => {
    const k = await referrerKpis(r.id as string);
    return { id: r.id as string, name: r.name as string, type: r.type as ReferrerType, referrals: k.referrals, admissions: k.admissions, revenue: k.revenue, score: k.score };
  }));
  return rows.sort((a, b) => b.score - a.score || b.revenue - a.revenue).slice(0, take);
}

export interface SourceRevenueRow {
  source: string;
  label: string;
  referrals: number;
  revenue: number;
}

/** Revenue + referral counts grouped by referral type (the source channel). */
export async function revenueBySource(): Promise<SourceRevenueRow[]> {
  const refs = await prisma.referral.findMany();
  const traces = await Promise.all(refs.map((r) => traceReferral(r)));
  const by = new Map<string, { referrals: number; revenue: number }>();
  refs.forEach((r, i) => {
    const key = String(r.type);
    const g = by.get(key) ?? { referrals: 0, revenue: 0 };
    g.referrals += 1;
    g.revenue += traces[i].revenue;
    by.set(key, g);
  });
  const label = (t: string) => (REFERRER_TYPE_LABELS as Record<string, string>)[t] ?? t.replace(/_/g, " ");
  return [...by.entries()].map(([source, g]) => ({ source, label: label(source), ...g })).sort((a, b) => b.revenue - a.revenue);
}
