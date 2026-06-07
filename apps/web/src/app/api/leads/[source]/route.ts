import { NextRequest, NextResponse } from "next/server";
import { normaliseInboundLead, type InboundLead } from "@prm/integrations";
import { prisma } from "@/lib/db";
import { runAutomation } from "@/lib/automation";

/**
 * Inbound lead intake (master doc §9): website form, Facebook/Meta lead ads,
 * Google Ads. POST a JSON payload to /api/leads/{website|facebook|google}.
 * This route *is* the "new enquiry → create lead" automation effect, so it
 * creates the lead directly (and runs duplicate detection), rather than
 * re-firing the create-lead rule.
 */
const SOURCE_MASTER: Record<string, string> = {
  website: "website",
  facebook: "social_media",
  google: "google_ads",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  const { source } = await params;
  if (!(source in SOURCE_MASTER)) {
    return NextResponse.json({ error: `Unknown source '${source}'` }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const lead: InboundLead = normaliseInboundLead(source as InboundLead["source"], payload);
  if (!lead.phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 422 });
  }

  const srcMaster = await prisma.leadSourceMaster.findUnique({ where: { name: SOURCE_MASTER[source] } });
  const campaign = lead.campaignRef
    ? await prisma.campaign.findFirst({ where: { name: { contains: lead.campaignRef, mode: "insensitive" } } })
    : null;

  const created = await prisma.lead.create({
    data: {
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email ?? null,
      sourceId: srcMaster?.id ?? null,
      campaignId: campaign?.id ?? null,
      stage: "new_lead",
    },
  });

  const dup = await prisma.lead.findFirst({ where: { phone: lead.phone, id: { not: created.id } } });
  if (dup) await runAutomation("duplicate_mobile_detected", { leadId: created.id });

  return NextResponse.json({ ok: true, leadId: created.id, source }, { status: 201 });
}
