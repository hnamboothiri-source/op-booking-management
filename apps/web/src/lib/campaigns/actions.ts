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
      targetDisease: str(fd, "targetDisease"),
    },
  });
  await writeAudit({ actorId: user.id, action: "campaign.create", entity: "campaign", entityId: created.id });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${created.id}`);
}
