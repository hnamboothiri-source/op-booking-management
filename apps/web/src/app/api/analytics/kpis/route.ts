import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Read-only KPI feed for external BI (Phase 5 — Power BI / Metabase feed).
 * Returns the materialised rollup tables as JSON. Secured by BI_TOKEN when set
 * (`Authorization: Bearer <token>` or `?key=<token>`); open in local dev.
 *
 * Run the in-app "Materialise KPI rollups" action (or the daily cron) first to
 * populate the rollups.
 */
function authorised(req: NextRequest): boolean {
  const token = process.env.BI_TOKEN;
  if (!token) return true;
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return bearer === token || req.nextUrl.searchParams.get("key") === token;
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const [branchKpi, doctorKpi, campaignKpi, branches, doctors, campaigns] = await Promise.all([
    prisma.branchKPI.findMany(),
    prisma.doctorKPI.findMany(),
    prisma.campaignKPI.findMany(),
    prisma.branch.findMany({ select: { id: true, name: true } }),
    prisma.doctor.findMany({ select: { id: true, name: true } }),
    prisma.campaign.findMany({ select: { id: true, name: true } }),
  ]);

  const bName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const dName = (id: string) => doctors.find((d) => d.id === id)?.name ?? id;
  const cName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    currency: "INR-paise",
    branchKpi: branchKpi.map((k) => ({ branch: bName(k.branchId), leads: k.leads, appointments: k.appointments, consultations: k.consultations, admissions: k.admissions, revenue: k.revenue })),
    doctorKpi: doctorKpi.map((k) => ({ doctor: dName(k.doctorId), consultations: k.consultations, admissionsRecommended: k.admissionsRec, followUpsAdvised: k.followUpsAdv, noShows: k.noShows })),
    campaignKpi: campaignKpi.map((k) => ({ campaign: cName(k.campaignId), leads: k.leads, consultations: k.consultations, admissions: k.admissions, revenue: k.revenue, spend: k.spend })),
  });
}
