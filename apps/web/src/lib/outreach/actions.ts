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

async function sourceId(name: string): Promise<string | null> {
  const s = await prisma.leadSourceMaster.findUnique({ where: { name } });
  return s?.id ?? null;
}

// ---------------- Camps (M7) ----------------

export async function createCamp(fd: FormData): Promise<void> {
  const user = await requireCan("camps", "create");
  const name = str(fd, "name");
  if (!name) throw new Error("Camp name is required");
  const scheduledAt = str(fd, "scheduledAt");
  const created = await prisma.camp.create({
    data: {
      name,
      location: str(fd, "location"),
      organizerId: str(fd, "organizerId"),
      coordinatorId: user.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });
  await writeAudit({ actorId: user.id, action: "camp.create", entity: "camp", entityId: created.id });
  revalidatePath("/camps");
  redirect(`/camps/${created.id}`);
}

export async function addCampPatient(campId: string, fd: FormData): Promise<void> {
  const user = await requireCan("camps", "edit");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  if (!contactName) throw new Error("Patient name is required");
  const recommendedVisit = fd.get("recommendedVisit") === "on";

  await prisma.$transaction(async (tx) => {
    await tx.campPatient.create({
      data: { campId, contactName, phone, complaint: str(fd, "complaint"), recommendedVisit },
    });
    await tx.camp.update({ where: { id: campId }, data: { patientsScreened: { increment: 1 } } });
  });

  // Recommended-for-visit screenings become leads (camp → consultation funnel).
  if (recommendedVisit && phone) {
    await prisma.lead.create({
      data: { contactName, phone, sourceId: await sourceId("camp"), ownerId: user.id, stage: "interested" },
    });
  }
  await writeAudit({ actorId: user.id, action: "camp.screen", entity: "camp", entityId: campId, after: { contactName, recommendedVisit } });
  revalidatePath(`/camps/${campId}`);
}

// ---------------- Mobile clinics (M8) ----------------

export async function createMobileClinic(fd: FormData): Promise<void> {
  const user = await requireCan("mobile_clinics", "create");
  const routeName = str(fd, "routeName");
  if (!routeName) throw new Error("Route name is required");
  const scheduledAt = str(fd, "scheduledAt");
  const created = await prisma.mobileClinic.create({
    data: { routeName, location: str(fd, "location"), coordinatorId: user.id, scheduledAt: scheduledAt ? new Date(scheduledAt) : null },
  });
  await writeAudit({ actorId: user.id, action: "mobileclinic.create", entity: "mobile_clinic", entityId: created.id });
  revalidatePath("/mobile-clinics");
  redirect(`/mobile-clinics/${created.id}`);
}

export async function addMobilePatient(clinicId: string, fd: FormData): Promise<void> {
  const user = await requireCan("mobile_clinics", "edit");
  const contactName = str(fd, "contactName");
  const phone = str(fd, "phone");
  if (!contactName) throw new Error("Patient name is required");
  const referredToBranch = fd.get("referredToBranch") === "on";

  await prisma.$transaction(async (tx) => {
    await tx.mobileClinicPatient.create({
      data: { mobileClinicId: clinicId, contactName, phone, complaint: str(fd, "complaint"), referredToBranch },
    });
    await tx.mobileClinic.update({ where: { id: clinicId }, data: { patientsScreened: { increment: 1 } } });
  });

  if (referredToBranch && phone) {
    await prisma.lead.create({
      data: { contactName, phone, sourceId: await sourceId("mobile_clinic"), ownerId: user.id, stage: "interested" },
    });
  }
  await writeAudit({ actorId: user.id, action: "mobileclinic.screen", entity: "mobile_clinic", entityId: clinicId, after: { contactName, referredToBranch } });
  revalidatePath(`/mobile-clinics/${clinicId}`);
}
