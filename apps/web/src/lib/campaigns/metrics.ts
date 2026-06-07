import { prisma } from "../db";
import { campaignKpis, type CampaignKpis } from "@prm/core";

/**
 * Trace a campaign's funnel: leads → bookings → consultations → admitted
 * admissions, summing admitted-package cost as attributed revenue. The campaign
 * budget is treated as spend.
 */
export async function computeCampaignKpis(campaignId: string, spend: number): Promise<CampaignKpis> {
  const leads = await prisma.lead.findMany({ where: { campaignId }, select: { id: true } });
  const leadIds = leads.map((l) => l.id);

  let consultations = 0;
  let admissions = 0;
  let revenue = 0;

  if (leadIds.length) {
    const bookings = await prisma.opBooking.findMany({ where: { leadId: { in: leadIds } }, select: { id: true } });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length) {
      consultations = await prisma.consultation.count({ where: { bookingId: { in: bookingIds } } });
      const recs = await prisma.admissionRecommendation.findMany({
        where: { status: "admitted", consultation: { bookingId: { in: bookingIds } } },
        select: { estimatedCost: true },
      });
      admissions = recs.length;
      revenue = recs.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);
    }
  }

  return campaignKpis({ leads: leads.length, consultations, admissions, revenue, spend });
}
