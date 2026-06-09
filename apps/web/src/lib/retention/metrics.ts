import { plvTier, isContactedOutcome, isReactivatedOutcome, REACTIVATION_FUNNEL_LABELS, type PlvTier } from "@prm/core";
import type { FunnelStage } from "@/components/charts/LeadFunnelChart";
import { prisma } from "../db";

// ── Patient Lifetime Value (4-way breakdown) ────────────────────────────────
export interface Plv {
  consultation: number; // paise
  medicine: number;
  therapy: number;
  package: number; // admitted-package revenue
  total: number;
  revenue: number; // alias of total (back-compat)
  visits: number;
  tenureDays: number;
  tier: PlvTier;
}

const MS_DAY = 86400000;
const sum = (rows: { [k: string]: unknown }[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);

/**
 * PLV for one patient — true 4-way breakdown from per-line cost fields
 * (Consultation.fee, MedicationCourse.cost, TherapyPlan.cost, admitted
 * AdmissionRecommendation.estimatedCost). Falls back to lifetimeRevenue only
 * when every component is empty. Mock-safe (per-patient findMany + reduce).
 */
export async function computePlv(mrd: string): Promise<Plv> {
  const [p, consults, courses, therapies, admits] = await Promise.all([
    prisma.patient.findUnique({ where: { mrd }, select: { lifetimeRevenue: true, lifetimeVisits: true, createdAt: true } }).catch(() => null),
    prisma.consultation.findMany({ where: { patientMrd: mrd }, select: { fee: true } }).catch(() => [] as { fee: number | null }[]),
    prisma.medicationCourse.findMany({ where: { patientMrd: mrd }, select: { cost: true } }).catch(() => [] as { cost: number | null }[]),
    prisma.therapyPlan.findMany({ where: { patientMrd: mrd }, select: { cost: true } }).catch(() => [] as { cost: number | null }[]),
    prisma.admissionRecommendation.findMany({ where: { patientMrd: mrd, status: "admitted" }, select: { estimatedCost: true } }).catch(() => [] as { estimatedCost: number | null }[]),
  ]);
  const consultation = sum(consults as Record<string, unknown>[], "fee");
  const medicine = sum(courses as Record<string, unknown>[], "cost");
  const therapy = sum(therapies as Record<string, unknown>[], "cost");
  const pkg = sum(admits as Record<string, unknown>[], "estimatedCost");
  let total = consultation + medicine + therapy + pkg;
  if (total === 0) total = p?.lifetimeRevenue ?? 0; // fallback when no cost lines
  const visits = p?.lifetimeVisits ?? 0;
  const tenureDays = p?.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(p.createdAt).getTime()) / MS_DAY)) : 0;
  return { consultation, medicine, therapy, package: pkg, total, revenue: total, visits, tenureDays, tier: plvTier(total) };
}

export interface PlvRow {
  mrd: string;
  name: string;
  consultation: number;
  medicine: number;
  therapy: number;
  package: number;
  total: number;
  visits: number;
  tier: PlvTier;
}

/** Top patients by lifetime value (with component breakdown). */
export async function plvRanking(take = 20): Promise<PlvRow[]> {
  const patients = await prisma.patient
    .findMany({ select: { mrd: true, name: true, lifetimeVisits: true } })
    .catch(() => [] as { mrd: string; name: string; lifetimeVisits: number }[]);
  const rows = await Promise.all(
    patients.map(async (p) => {
      const v = await computePlv(p.mrd);
      return { mrd: p.mrd, name: p.name, consultation: v.consultation, medicine: v.medicine, therapy: v.therapy, package: v.package, total: v.total, visits: p.lifetimeVisits ?? 0, tier: v.tier };
    }),
  );
  return rows.sort((a, b) => b.total - a.total).slice(0, take);
}

// ── Reactivation funnel ─────────────────────────────────────────────────────
/**
 * Reactivation funnel: assigned (have a success owner) → contacted → responded →
 * booked → reactivated. Computed from RetentionStatus + RetentionActivity logs.
 */
export async function retentionFunnel(): Promise<FunnelStage[]> {
  const [statuses, activities] = await Promise.all([
    prisma.retentionStatus.findMany({ select: { patientMrd: true, successOwnerId: true, category: true } }).catch(() => [] as { patientMrd: string; successOwnerId: string | null; category: string }[]),
    prisma.retentionActivity.findMany({ select: { patientMrd: true, outcome: true } }).catch(() => [] as { patientMrd: string; outcome: string }[]),
  ]);
  const assigned = statuses.filter((s) => s.successOwnerId).length;
  const contactedSet = new Set<string>();
  const respondedSet = new Set<string>();
  const bookedSet = new Set<string>();
  for (const a of activities) {
    contactedSet.add(a.patientMrd); // any attempt logged
    if (isContactedOutcome(a.outcome)) respondedSet.add(a.patientMrd);
    if (isReactivatedOutcome(a.outcome)) bookedSet.add(a.patientMrd);
  }
  const reactivated = statuses.filter((s) => s.category === "reactivated").length;
  return [
    { label: REACTIVATION_FUNNEL_LABELS.assigned, value: assigned },
    { label: REACTIVATION_FUNNEL_LABELS.contacted, value: contactedSet.size },
    { label: REACTIVATION_FUNNEL_LABELS.responded, value: respondedSet.size },
    { label: REACTIVATION_FUNNEL_LABELS.booked, value: bookedSet.size },
    { label: REACTIVATION_FUNNEL_LABELS.reactivated, value: reactivated, entity: "retention", filters: { category: "reactivated" } },
  ];
}

// ── Patient-Success-Executive productivity ──────────────────────────────────
export interface ExecRow {
  id: string;
  name: string;
  assigned: number;
  contacted: number;
  reactivated: number;
  conversionPct: number;
}

/** Productivity per success owner: assigned / contacted / reactivated / conversion%. */
export async function executiveProductivity(): Promise<ExecRow[]> {
  const [statuses, activities, staff] = await Promise.all([
    prisma.retentionStatus.findMany({ select: { patientMrd: true, successOwnerId: true } }).catch(() => [] as { patientMrd: string; successOwnerId: string | null }[]),
    prisma.retentionActivity.findMany({ select: { patientMrd: true, actorId: true, outcome: true } }).catch(() => [] as { patientMrd: string; actorId: string | null; outcome: string }[]),
    prisma.staffUser.findMany({ where: { active: true }, select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
  ]);
  const ownerOf = new Map<string, string>(); // patientMrd → ownerId
  for (const s of statuses) if (s.successOwnerId) ownerOf.set(s.patientMrd, s.successOwnerId);

  const rows = new Map<string, { assigned: Set<string>; contacted: Set<string>; reactivated: Set<string> }>();
  const ensure = (id: string) => {
    let r = rows.get(id);
    if (!r) { r = { assigned: new Set(), contacted: new Set(), reactivated: new Set() }; rows.set(id, r); }
    return r;
  };
  for (const s of statuses) if (s.successOwnerId) ensure(s.successOwnerId).assigned.add(s.patientMrd);
  for (const a of activities) {
    const owner = a.actorId ?? ownerOf.get(a.patientMrd);
    if (!owner) continue;
    const r = ensure(owner);
    if (isContactedOutcome(a.outcome)) r.contacted.add(a.patientMrd);
    if (isReactivatedOutcome(a.outcome)) r.reactivated.add(a.patientMrd);
  }
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "Unassigned";
  return [...rows.entries()]
    .map(([id, r]) => ({
      id,
      name: nameOf(id),
      assigned: r.assigned.size,
      contacted: r.contacted.size,
      reactivated: r.reactivated.size,
      conversionPct: r.assigned.size ? Math.round((r.reactivated.size / r.assigned.size) * 100) : 0,
    }))
    .sort((a, b) => b.reactivated - a.reactivated || b.assigned - a.assigned);
}

// ── Retention rate + repeat-visit rate ───────────────────────────────────────
export interface RetentionRate {
  total: number;
  active: number;
  reactivated: number;
  lost: number;
  ratePct: number; // (active + reactivated) / total
}

export async function retentionRate(): Promise<RetentionRate> {
  const statuses = await prisma.retentionStatus.findMany({ select: { category: true } }).catch(() => [] as { category: string }[]);
  const total = statuses.length;
  const active = statuses.filter((s) => s.category === "active").length;
  const reactivated = statuses.filter((s) => s.category === "reactivated").length;
  const lost = statuses.filter((s) => s.category === "lost").length;
  const ratePct = total ? Math.round(((active + reactivated) / total) * 100) : 0;
  return { total, active, reactivated, lost, ratePct };
}

/** Share of patients who are repeat visitors (lifetimeVisits > 1). */
export async function repeatVisitRate(): Promise<{ repeat: number; total: number; pct: number }> {
  const patients = await prisma.patient.findMany({ select: { lifetimeVisits: true } }).catch(() => [] as { lifetimeVisits: number }[]);
  const total = patients.length;
  const repeat = patients.filter((p) => (p.lifetimeVisits ?? 0) > 1).length;
  return { repeat, total, pct: total ? Math.round((repeat / total) * 100) : 0 };
}

// ── Doctor-wise retention ────────────────────────────────────────────────────
export interface DoctorRetentionRow {
  doctorId: string;
  name: string;
  patients: number;
  retained: number;
  lost: number;
  retainedPct: number;
}

/**
 * Doctor-wise retention: group each patient's retention category by the doctor
 * on their most recent consultation. Mock-safe (no relation-filter wheres).
 */
export async function doctorWiseRetention(): Promise<DoctorRetentionRow[]> {
  const [consults, statuses, staff] = await Promise.all([
    prisma.consultation.findMany({ select: { patientMrd: true, doctorId: true, createdAt: true } }).catch(() => [] as { patientMrd: string | null; doctorId: string | null; createdAt: Date }[]),
    prisma.retentionStatus.findMany({ select: { patientMrd: true, category: true } }).catch(() => [] as { patientMrd: string; category: string }[]),
    prisma.staffUser.findMany({ where: { active: true }, select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
  ]);
  // latest doctor per patient
  const latest = new Map<string, { doctorId: string | null; at: number }>();
  for (const c of consults) {
    if (!c.patientMrd) continue;
    const at = new Date(c.createdAt).getTime();
    const cur = latest.get(c.patientMrd);
    if (!cur || at > cur.at) latest.set(c.patientMrd, { doctorId: c.doctorId, at });
  }
  const catOf = new Map(statuses.map((s) => [s.patientMrd, s.category]));
  const by = new Map<string, { patients: number; retained: number; lost: number }>();
  for (const [mrd, { doctorId }] of latest) {
    if (!doctorId) continue;
    const cat = catOf.get(mrd);
    if (!cat) continue;
    const g = by.get(doctorId) ?? { patients: 0, retained: 0, lost: 0 };
    g.patients += 1;
    if (cat === "active" || cat === "reactivated") g.retained += 1;
    if (cat === "lost" || cat === "dormant") g.lost += 1;
    by.set(doctorId, g);
  }
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  return [...by.entries()]
    .map(([doctorId, g]) => ({ doctorId, name: nameOf(doctorId), patients: g.patients, retained: g.retained, lost: g.lost, retainedPct: g.patients ? Math.round((g.retained / g.patients) * 100) : 0 }))
    .sort((a, b) => b.patients - a.patients);
}

// ── Dormant patient worklist ────────────────────────────────────────────────
export interface WorklistFilters {
  branchId?: string;
  doctorId?: string;
  diseaseId?: string;
  minDays?: number;
  successOwnerId?: string;
}
export interface WorklistRow {
  mrd: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  category: string;
  riskScore: number;
  retentionScore: number | null;
  lastVisitDate: Date | null;
  daysSinceVisit: number;
  doctorId: string | null;
  doctorName: string;
  branchId: string | null;
  diseaseId: string | null;
  diseaseName: string;
  successOwnerId: string | null;
}

/**
 * Dormant/at-risk/lost worklist. Derives each patient's latest-consultation
 * doctor/branch/disease (no denormalized Patient fields), pulls the latest
 * retention score, and filters in-memory. Mock-safe.
 */
export async function dormantWorklist(f: WorklistFilters = {}): Promise<WorklistRow[]> {
  const [statuses, consults, scores, doctors, diseases] = await Promise.all([
    prisma.retentionStatus.findMany({ where: { category: { in: ["at_risk", "dormant", "lost"] } }, include: { patient: true } }).catch(() => [] as Record<string, unknown>[]),
    prisma.consultation.findMany({ select: { patientMrd: true, doctorId: true, branchId: true, diseaseId: true, createdAt: true } }).catch(() => [] as { patientMrd: string | null; doctorId: string | null; branchId: string | null; diseaseId: string | null; createdAt: Date }[]),
    prisma.patientScore.findMany({ where: { kind: "retention" }, orderBy: { computedAt: "desc" } }).catch(() => [] as { patientMrd: string; score: number }[]),
    prisma.doctor.findMany({ select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
    prisma.diseaseMaster.findMany({ select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
  ]);
  // latest consultation per patient
  const latest = new Map<string, { doctorId: string | null; branchId: string | null; diseaseId: string | null; at: number }>();
  for (const c of consults) {
    if (!c.patientMrd) continue;
    const at = new Date(c.createdAt).getTime();
    const cur = latest.get(c.patientMrd);
    if (!cur || at > cur.at) latest.set(c.patientMrd, { doctorId: c.doctorId, branchId: c.branchId, diseaseId: c.diseaseId, at });
  }
  const retScore = new Map<string, number>();
  for (const s of scores) if (!retScore.has(s.patientMrd)) retScore.set(s.patientMrd, s.score);
  const docName = (id: string | null) => doctors.find((d) => d.id === id)?.name ?? "—";
  const disName = (id: string | null) => diseases.find((d) => d.id === id)?.name ?? "—";
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: WorklistRow[] = (statuses as any[]).map((s) => {
    const l = latest.get(s.patientMrd);
    const lvd = s.patient?.lastVisitDate ?? null;
    const days = lvd ? Math.max(0, Math.floor((today - new Date(new Date(lvd).toISOString().slice(0, 10)).getTime()) / MS_DAY)) : 9999;
    return {
      mrd: s.patientMrd,
      name: s.patient?.name ?? s.patientMrd,
      phone: s.patient?.phone ?? null,
      whatsapp: s.patient?.whatsapp ?? null,
      category: s.category,
      riskScore: s.riskScore,
      retentionScore: retScore.get(s.patientMrd) ?? null,
      lastVisitDate: lvd,
      daysSinceVisit: days,
      doctorId: l?.doctorId ?? null,
      doctorName: docName(l?.doctorId ?? null),
      branchId: l?.branchId ?? null,
      diseaseId: l?.diseaseId ?? null,
      diseaseName: disName(l?.diseaseId ?? null),
      successOwnerId: s.successOwnerId ?? null,
    };
  });

  return rows
    .filter((r) => (f.branchId ? r.branchId === f.branchId : true))
    .filter((r) => (f.doctorId ? r.doctorId === f.doctorId : true))
    .filter((r) => (f.diseaseId ? r.diseaseId === f.diseaseId : true))
    .filter((r) => (f.minDays ? r.daysSinceVisit >= f.minDays : true))
    .filter((r) => (f.successOwnerId ? r.successOwnerId === f.successOwnerId : true))
    .sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
}

// ── Reactivation campaigns + per-campaign response funnel ────────────────────
export interface CampaignRow {
  id: string;
  name: string;
  program: string | null;
  channel: string;
  status: string;
  launchedAt: Date | null;
  sent: number;
  contacted: number;
  responded: number;
  booked: number;
}

/** List reactivation Campaign rows (program set) + a response funnel from RetentionActivity. */
export async function reactivationCampaigns(): Promise<CampaignRow[]> {
  const campaigns = await prisma.campaign.findMany({ where: { program: { not: null } }, orderBy: { createdAt: "desc" } }).catch(() => [] as Record<string, unknown>[]);
  const activities = await prisma.retentionActivity.findMany({ select: { campaignId: true, outcome: true } }).catch(() => [] as { campaignId: string | null; outcome: string }[]);
  const byCampaign = new Map<string, { sent: number; contacted: number; responded: number; booked: number }>();
  for (const a of activities) {
    if (!a.campaignId) continue;
    const g = byCampaign.get(a.campaignId) ?? { sent: 0, contacted: 0, responded: 0, booked: 0 };
    g.sent += 1;
    if (isContactedOutcome(a.outcome)) { g.contacted += 1; g.responded += 1; }
    if (isReactivatedOutcome(a.outcome)) g.booked += 1;
    byCampaign.set(a.campaignId, g);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (campaigns as any[]).map((c) => {
    const g = byCampaign.get(c.id) ?? { sent: 0, contacted: 0, responded: 0, booked: 0 };
    return { id: c.id, name: c.name, program: c.program ?? null, channel: String(c.type), status: c.status, launchedAt: c.launchedAt ?? null, ...g };
  });
}
