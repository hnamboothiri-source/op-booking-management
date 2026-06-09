"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { assertPlannedActivity } from "../planning/gate";
import { referrerKpis } from "./metrics";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

export async function createReferral(fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "create");
  const type = fd.get("type")?.toString() || "patient_to_patient";
  const planRef = str(fd, "planRef");
  await assertPlannedActivity("referrals", "referral_drive", planRef);

  const referrerId = str(fd, "referrerId");
  const created = await prisma.referral.create({
    data: {
      planRef,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      referrerPatientMrd: str(fd, "referrerPatientMrd"),
      referrerName: str(fd, "referrerName"),
      organizationId: str(fd, "organizationId"),
      referrerId,
      referredPatientMrd: str(fd, "referredPatientMrd"),
      branchId: str(fd, "branchId"),
      rewardEligible: fd.get("rewardEligible") === "on",
    },
  });
  await writeAudit({ actorId: user.id, action: "referral.create", entity: "referral", entityId: created.id, after: { type } });
  if (referrerId) await recomputeReferrerScore(referrerId);
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
  const ref = await prisma.referral.findUnique({ where: { id }, select: { referrerId: true } });
  if (ref?.referrerId) await recomputeReferrerScore(ref.referrerId);
  revalidatePath("/referrals");
}

// ----------------------------------------------------- referrer profiles + relationship log

const INTERACTION_MEETINGS = new Set(["visit", "meeting", "cme"]);

export async function createReferrer(fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "create");
  const name = str(fd, "name");
  if (!name) throw new Error("Referrer name is required.");
  const created = await prisma.referrer.create({
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (fd.get("type")?.toString() || "doctor") as any,
      name,
      specialty: str(fd, "specialty"),
      hospitalName: str(fd, "hospitalName"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      location: str(fd, "location"),
      relationManagerId: str(fd, "relationManagerId") ?? user.id,
      notes: str(fd, "notes"),
    },
  });
  await writeAudit({ actorId: user.id, action: "referrer.create", entity: "referrer", entityId: created.id as string, after: { name } });
  revalidatePath("/referrals/referrers");
  redirect(`/referrals/referrers/${created.id}`);
}

export async function updateReferrer(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "edit");
  await prisma.referrer.update({
    where: { id },
    data: {
      name: str(fd, "name") ?? undefined,
      specialty: str(fd, "specialty"),
      hospitalName: str(fd, "hospitalName"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      location: str(fd, "location"),
      relationManagerId: str(fd, "relationManagerId"),
      notes: str(fd, "notes"),
      active: fd.get("active") === "on",
    },
  });
  await writeAudit({ actorId: user.id, action: "referrer.update", entity: "referrer", entityId: id });
  revalidatePath(`/referrals/referrers/${id}`);
}

/** Log a relationship interaction (visit / call / CME …); updates meeting + follow-up dates. */
export async function logReferrerInteraction(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "edit");
  const type = fd.get("type")?.toString() || "visit";
  const outcome = str(fd, "outcome");
  if (!outcome) throw new Error("Interaction outcome is required.");
  const nextFollowUp = str(fd, "nextFollowUp");
  await prisma.referrerInteraction.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { referrerId: id, type: type as any, outcome, notes: str(fd, "notes"), actorId: user.id, nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null },
  });
  await prisma.referrer.update({
    where: { id },
    data: {
      ...(INTERACTION_MEETINGS.has(type) ? { lastMeetingDate: new Date() } : {}),
      ...(nextFollowUp ? { nextFollowUp: new Date(nextFollowUp) } : {}),
    },
  });
  await writeAudit({ actorId: user.id, action: "referrer.log_interaction", entity: "referrer", entityId: id, after: { type, outcome } });
  revalidatePath(`/referrals/referrers/${id}`);
}

/** Recompute + persist a referrer's score (also computed live on the profile). */
export async function recomputeReferrerScore(id: string): Promise<void> {
  const k = await referrerKpis(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.referrer.update({ where: { id }, data: { score: k.score, scoreFactors: k.factors as any } });
}

/** Create a lead from a referral and link it (the "Lead Created" lifecycle step). */
export async function convertReferralToLead(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("referrals", "edit");
  const ref = await prisma.referral.findUnique({ where: { id }, include: { referredPatient: true } });
  if (!ref) throw new Error("Referral not found.");
  const contactName = str(fd, "contactName") ?? ref.referredPatient?.name ?? "Referred contact";
  const phone = str(fd, "phone") ?? ref.referredPatient?.phone ?? "";
  const lead = await prisma.lead.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { contactName, phone, patientMrd: ref.referredPatientMrd, stage: "new_lead", responseChannel: "referral" as any },
  });
  await prisma.referral.update({ where: { id }, data: { referredLeadId: lead.id as string } });
  await writeAudit({ actorId: user.id, action: "referral.convert_lead", entity: "referral", entityId: id, after: { leadId: lead.id } });
  revalidatePath("/referrals");
}
