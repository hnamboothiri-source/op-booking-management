"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { quoteForReach } from "@prm/core";
import { assertPlannedActivity } from "../planning/gate";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function createCampaign(fd: FormData): Promise<void> {
  const user = await requireCan("campaigns", "create");
  const name = str(fd, "name");
  const type = fd.get("type")?.toString() || "facebook_ads";
  if (!name) throw new Error("Campaign name is required");
  const planRef = str(fd, "planRef");
  await assertPlannedActivity("campaigns", "launch_campaign", planRef);
  const budgetRupees = str(fd, "budget");
  const start = str(fd, "startDate");
  const end = str(fd, "endDate");

  const created = await prisma.campaign.create({
    data: {
      name,
      planRef,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      budget: budgetRupees ? Math.round(parseFloat(budgetRupees) * 100) : 0,
      sourceId: str(fd, "sourceId"),
      startDate: start ? new Date(start) : null,
      endDate: end ? new Date(end) : null,
      targetLocation: str(fd, "targetLocation"),
      targetDistrict: str(fd, "targetDistrict"),
      targetDisease: str(fd, "targetDisease"),
      targetAgeMin: num(fd, "targetAgeMin"),
      targetAgeMax: num(fd, "targetAgeMax"),
      targetGender: str(fd, "targetGender"),
      targetAudience: str(fd, "targetAudience"),
    },
  });
  await writeAudit({ actorId: user.id, action: "campaign.create", entity: "campaign", entityId: created.id });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${created.id}`);
}

/** Add a channel line-item to a campaign, auto-quoting cost from the channel
 * master's rate + any active seasonal offer (FRS §3-5). Manual cost still wins. */
export async function addCampaignChannel(campaignId: string, fd: FormData): Promise<void> {
  const user = await requireCan("campaigns", "create");
  const channelMasterId = str(fd, "channelMasterId");
  const enteredReach = num(fd, "promisedReach") ?? 0;
  const enteredCost = str(fd, "quotedCost");

  let channel = fd.get("channel")?.toString() || "other";
  let promisedReach = enteredReach;
  let quotedCost = enteredCost ? Math.round(parseFloat(enteredCost) * 100) : 0;

  if (channelMasterId) {
    const master = await prisma.marketingChannelMaster.findUnique({ where: { id: channelMasterId } });
    if (master) {
      channel = master.name;
      // Active seasonal offer (today within window).
      const now = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const offers = await prisma.channelSeasonalOffer.findMany({ where: { channelMasterId, active: true } as any });
      const offer = offers.find((o) => new Date(o.fromDate) <= now && now <= new Date(o.toDate));
      const q = quoteForReach({ pricingModel: master.pricingModel, baseRate: master.baseRate, reach: enteredReach, discountPct: offer?.discountPct, bonusReachPct: offer?.bonusReachPct });
      promisedReach = q.effectiveReach;
      if (!enteredCost) quotedCost = q.cost; // blank → auto-quote
    }
  }

  await prisma.campaignChannel.create({
    data: { campaignId, channel, channelMasterId, promisedReach, quotedCost, notes: str(fd, "notes") },
  });
  await writeAudit({ actorId: user.id, action: "campaign.add_channel", entity: "campaign", entityId: campaignId, after: { channel, promisedReach, quotedCost } });
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Revise a campaign's pre-launch plan (area, audience, budget, dates) — FRS §1-2. */
export async function updateCampaignPlan(campaignId: string, fd: FormData): Promise<void> {
  const user = await requireCan("campaigns", "edit");
  const budgetRupees = str(fd, "budget");
  const start = str(fd, "startDate");
  const end = str(fd, "endDate");
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      budget: budgetRupees ? Math.round(parseFloat(budgetRupees) * 100) : 0,
      startDate: start ? new Date(start) : null,
      endDate: end ? new Date(end) : null,
      targetLocation: str(fd, "targetLocation"),
      targetDistrict: str(fd, "targetDistrict"),
      targetDisease: str(fd, "targetDisease"),
      targetAgeMin: num(fd, "targetAgeMin"),
      targetAgeMax: num(fd, "targetAgeMax"),
      targetGender: str(fd, "targetGender"),
      targetAudience: str(fd, "targetAudience"),
    },
  });
  await writeAudit({ actorId: user.id, action: "campaign.update_plan", entity: "campaign", entityId: campaignId });
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Drop a channel line-item from a campaign plan. */
export async function removeCampaignChannel(channelId: string, campaignId: string): Promise<void> {
  const user = await requireCan("campaigns", "edit");
  await prisma.campaignChannel.delete({ where: { id: channelId } });
  await writeAudit({ actorId: user.id, action: "campaign.remove_channel", entity: "campaign_channel", entityId: channelId });
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Record a channel's achieved reach (FRS §5). */
export async function setAchievedReach(channelId: string, campaignId: string, fd: FormData): Promise<void> {
  const user = await requireCan("campaigns", "edit");
  const v = str(fd, "achievedReach");
  await prisma.campaignChannel.update({ where: { id: channelId }, data: { achievedReach: v ? parseInt(v, 10) : null } });
  await writeAudit({ actorId: user.id, action: "campaign.achieved_reach", entity: "campaign_channel", entityId: channelId });
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Launch a campaign: set it running and stamp the 24h-response window start (FRS §5). */
export async function launchCampaign(campaignId: string): Promise<void> {
  const user = await requireCan("campaigns", "edit");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "running", launchedAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "campaign.launch", entity: "campaign", entityId: campaignId });
  revalidatePath(`/campaigns/${campaignId}`);
}

/** Mark a campaign completed. */
export async function completeCampaign(campaignId: string): Promise<void> {
  const user = await requireCan("campaigns", "edit");
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "completed" } });
  await writeAudit({ actorId: user.id, action: "campaign.complete", entity: "campaign", entityId: campaignId });
  revalidatePath(`/campaigns/${campaignId}`);
}
