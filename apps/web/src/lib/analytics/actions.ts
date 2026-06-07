"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { computeCampaignKpis } from "../campaigns/metrics";

/**
 * Materialise KPI rollup tables (BranchKPI / DoctorKPI / CampaignKPI) for an
 * all-time period, for external BI (Metabase / Power BI). The in-app analytics
 * page reads live; these tables are the export surface. Idempotent: clears and
 * rewrites the rollups each run.
 */
export async function recomputeKpis(): Promise<void> {
  const user = await requireCan("reports", "view");
  const periodStart = new Date("2000-01-01");
  const periodEnd = new Date(new Date().toISOString().slice(0, 10));

  const [branches, doctors, campaigns] = await Promise.all([
    prisma.branch.findMany(),
    prisma.doctor.findMany(),
    prisma.campaign.findMany(),
  ]);

  await prisma.$transaction([prisma.branchKPI.deleteMany(), prisma.doctorKPI.deleteMany(), prisma.campaignKPI.deleteMany()]);

  for (const b of branches) {
    const [leads, appointments, consultations] = await Promise.all([
      prisma.lead.count({ where: { branchId: b.id } }),
      prisma.opBooking.count({ where: { branchId: b.id } }),
      prisma.consultation.count({ where: { branchId: b.id } }),
    ]);
    const admissions = await prisma.admissionRecommendation.count({ where: { status: "admitted", consultation: { branchId: b.id } } });
    await prisma.branchKPI.create({ data: { branchId: b.id, periodStart, periodEnd, leads, appointments, consultations, admissions } });
  }

  for (const d of doctors) {
    const [consultations, admissionsRec, followUpsAdv, noShows] = await Promise.all([
      prisma.consultation.count({ where: { doctorId: d.id } }),
      prisma.admissionRecommendation.count({ where: { doctorId: d.id } }),
      prisma.followUp.count({ where: { doctorId: d.id } }),
      prisma.opBooking.count({ where: { doctorId: d.id, status: "no_show" } }),
    ]);
    await prisma.doctorKPI.create({ data: { doctorId: d.id, periodStart, periodEnd, consultations, admissionsRec, followUpsAdv, noShows } });
  }

  for (const c of campaigns) {
    const k = await computeCampaignKpis(c.id, c.budget);
    await prisma.campaignKPI.create({ data: { campaignId: c.id, leads: k.leads, consultations: k.consultations, admissions: k.admissions, revenue: k.revenue, spend: k.spend } });
  }

  await writeAudit({ actorId: user.id, action: "kpi.recompute", entity: "kpi", after: { branches: branches.length, doctors: doctors.length, campaigns: campaigns.length } });
  revalidatePath("/analytics");
}
