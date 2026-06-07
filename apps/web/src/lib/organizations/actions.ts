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

export async function createOrganization(fd: FormData): Promise<void> {
  const user = await requireCan("organizations", "create");
  const name = str(fd, "name");
  const type = fd.get("type")?.toString() || "company";
  if (!name) throw new Error("Name is required");
  const contacts = (str(fd, "contactPersons") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((name) => ({ name }));
  const nextEngagement = str(fd, "nextEngagement");

  const created = await prisma.organization.create({
    data: {
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      contactPersons: contacts.length ? contacts : undefined,
      relationOwnerId: user.id,
      nextEngagement: nextEngagement ? new Date(nextEngagement) : null,
    },
  });
  await writeAudit({ actorId: user.id, action: "org.create", entity: "organization", entityId: created.id });
  revalidatePath("/organizations");
  redirect(`/organizations/${created.id}`);
}

export async function setNextEngagement(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("organizations", "edit");
  const date = str(fd, "nextEngagement");
  await prisma.organization.update({ where: { id }, data: { nextEngagement: date ? new Date(date) : null } });
  await writeAudit({ actorId: user.id, action: "org.engagement", entity: "organization", entityId: id });
  revalidatePath(`/organizations/${id}`);
}
