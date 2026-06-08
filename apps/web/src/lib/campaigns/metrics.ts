import { prisma } from "../db";
import { campaignKpis, withinHours, type CampaignKpis } from "@prm/core";

/**
 * Trace a campaign's funnel: reach (from its channels) → leads (incl. the 24h
 * response window) → bookings → consultations → admitted admissions, summing
 * admitted-package cost as attributed revenue. The campaign budget is spend.
 */
export async function computeCampaignKpis(
  campaignId: string,
  spend: number,
  launchedAt?: Date | null,
): Promise<CampaignKpis> {
  const [leads, channels] = await Promise.all([
    prisma.lead.findMany({ where: { campaignId }, select: { id: true, createdAt: true } }),
    prisma.campaignChannel.findMany({ where: { campaignId }, select: { promisedReach: true, achievedReach: true } }),
  ]);
  const leadIds = leads.map((l) => l.id);
  const leads24h = launchedAt ? leads.filter((l) => withinHours(new Date(l.createdAt), new Date(launchedAt), 24)).length : 0;
  const promisedReach = channels.reduce((s, c) => s + (c.promisedReach ?? 0), 0);
  const achievedReach = channels.reduce((s, c) => s + (c.achievedReach ?? 0), 0);

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

  return campaignKpis({ leads: leads.length, leads24h, consultations, admissions, revenue, spend, promisedReach, achievedReach });
}
