"use server";

import { redirect } from "next/navigation";
import { prisma } from "./db";
import { runAutomation } from "./automation";

/**
 * Public website enquiry intake — no auth (it's a patient-facing form).
 * Creates a website-sourced lead and runs duplicate detection.
 */
export async function submitPublicEnquiry(fd: FormData): Promise<void> {
  const contactName = fd.get("name")?.toString().trim();
  const phone = fd.get("phone")?.toString().trim();
  if (!contactName || !phone) throw new Error("Name and phone are required");

  const src = await prisma.leadSourceMaster.findUnique({ where: { name: "website" } });
  const created = await prisma.lead.create({
    data: {
      contactName,
      phone,
      email: fd.get("email")?.toString().trim() || null,
      sourceId: src?.id ?? null,
      stage: "new_lead",
    },
  });

  const dup = await prisma.lead.findFirst({ where: { phone, id: { not: created.id } } });
  if (dup) await runAutomation("duplicate_mobile_detected", { leadId: created.id });

  redirect("/enquiry?submitted=1");
}
