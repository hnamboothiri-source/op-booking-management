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

export async function createReferral(fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "create");
  const type = fd.get("type")?.toString() || "patient_to_patient";

  const created = await prisma.referral.create({
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      referrerPatientMrd: str(fd, "referrerPatientMrd"),
      referrerName: str(fd, "referrerName"),
      organizationId: str(fd, "organizationId"),
      referredPatientMrd: str(fd, "referredPatientMrd"),
      branchId: str(fd, "branchId"),
      rewardEligible: fd.get("rewardEligible") === "on",
    },
  });
  await writeAudit({ actorId: user.id, action: "referral.create", entity: "referral", entityId: created.id, after: { type } });
  revalidatePath("/referrals");
  redirect("/referrals");
}

export async function updateReferralStatus(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "edit");
  const status = fd.get("status")?.toString() || "pending";
  const revenueRupees = str(fd, "revenue");
  await prisma.referral.update({
    where: { id },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: status as any,
      ...(revenueRupees ? { revenue: Math.round(parseFloat(revenueRupees) * 100) } : {}),
    },
  });
  await writeAudit({ actorId: user.id, action: "referral.status", entity: "referral", entityId: id, after: { status } });
  revalidatePath("/referrals");
}
