"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

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
  const budgetRupees = str(fd, "budget");
  const start = str(fd, "startDate");
  const end = str(fd, "endDate");

  const created = await prisma.campaign.create({
    data: {
      name,
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

/** Add a channel line-item (assured reach quote) to a campaign (FRS §3-4). */
export async function addCampaignChannel(campaignId: string, fd: FormData): Promise<void> {
  const user = await requireCan("campaigns", "create");
  const channel = fd.get("channel")?.toString() || "other";
  const reach = str(fd, "promisedReach");
  const cost = str(fd, "quotedCost");
  await prisma.campaignChannel.create({
    data: {
      campaignId, channel,
      promisedReach: reach ? parseInt(reach, 10) : 0,
      quotedCost: cost ? Math.round(parseFloat(cost) * 100) : 0,
      notes: str(fd, "notes"),
    },
  });
  await writeAudit({ actorId: user.id, action: "campaign.add_channel", entity: "campaign", entityId: campaignId, after: { channel } });
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
