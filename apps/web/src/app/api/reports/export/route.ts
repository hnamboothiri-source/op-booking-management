import { NextRequest, NextResponse } from "next/server";
import { can, budgetTotals, onSiteRevenue, outreachRoi, type OutreachExpenseLine, type OutreachStaffLine, type OutreachRevenueLine } from "@prm/core";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { computeOutreachKpis, type OutreachEventType } from "@/lib/outreach/metrics";

/**
 * CSV export for report tables. GET /api/reports/export?type=<key>.
 * Auth: requires a logged-in user with reports-view permission.
 */
function csv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!can(user.role, "reports", "view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type") ?? "appointments-by-status";
  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  switch (type) {
    case "leads-by-source": {
      const [grp, sources] = await Promise.all([
        prisma.lead.groupBy({ by: ["sourceId"], _count: { _all: true } }),
        prisma.leadSourceMaster.findMany(),
      ]);
      headers = ["Source", "Leads"];
      rows = grp.map((g) => [sources.find((s) => s.id === g.sourceId)?.name?.replace(/_/g, " ") ?? "Unknown", g._count._all]);
      break;
    }
    case "appointments-by-status": {
      const grp = await prisma.opBooking.groupBy({ by: ["status"], _count: { _all: true } });
      headers = ["Status", "Appointments"];
      rows = grp.map((g) => [g.status, g._count._all]);
      break;
    }
    case "consultations-by-doctor": {
      const [grp, doctors] = await Promise.all([
        prisma.consultation.groupBy({ by: ["doctorId"], _count: { _all: true } }),
        prisma.doctor.findMany(),
      ]);
      headers = ["Doctor", "Consultations"];
      rows = grp.map((g) => [doctors.find((d) => d.id === g.doctorId)?.name ?? "Unknown", g._count._all]);
      break;
    }
    case "admission-funnel": {
      const grp = await prisma.admissionRecommendation.groupBy({ by: ["status"], _count: { _all: true } });
      headers = ["Status", "Count"];
      rows = grp.map((g) => [g.status, g._count._all]);
      break;
    }
    case "outreach-budget": {
      const [camps, clinics] = await Promise.all([prisma.camp.findMany(), prisma.mobileClinic.findMany()]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const line = (ev: any, kind: string) => {
        const t = budgetTotals((ev.expenses as OutreachExpenseLine[]) ?? [], (ev.staffRoster as OutreachStaffLine[]) ?? []);
        return [ev.name ?? ev.routeName, kind, t.plannedTotal / 100, t.actualTotal / 100, t.variance / 100];
      };
      headers = ["Event", "Type", "Planned (₹)", "Actual (₹)", "Variance (₹)"];
      rows = [...camps.map((c) => line(c, "camp")), ...clinics.map((c) => line(c, "mobile"))];
      break;
    }
    case "outreach-roi": {
      const [camps, clinics] = await Promise.all([prisma.camp.findMany(), prisma.mobileClinic.findMany()]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const line = async (ev: any, type: OutreachEventType) => {
        const t = budgetTotals((ev.expenses as OutreachExpenseLine[]) ?? [], (ev.staffRoster as OutreachStaffLine[]) ?? []);
        const onSite = onSiteRevenue((ev.revenueLines as OutreachRevenueLine[]) ?? []);
        const k = await computeOutreachKpis(type, ev.id);
        const roi = outreachRoi(t.actualTotal, onSite, k.downstreamRevenue);
        return [ev.name ?? ev.routeName, type, t.actualTotal / 100, onSite / 100, k.downstreamRevenue / 100, roi.revenue / 100, roi.roi ?? "", k.screened, k.admissions];
      };
      headers = ["Event", "Type", "Spend (₹)", "On-site (₹)", "Downstream (₹)", "Revenue (₹)", "ROI %", "Screened", "IP admissions"];
      rows = [...(await Promise.all(camps.map((c) => line(c, "camp")))), ...(await Promise.all(clinics.map((c) => line(c, "mobile"))))];
      break;
    }
    case "follow-up-compliance": {
      const grp = await prisma.followUp.groupBy({ by: ["status"], _count: { _all: true } });
      headers = ["Status", "Count"];
      rows = grp.map((g) => [g.status, g._count._all]);
      break;
    }
    case "treatment-funnel": {
      const [consultations, tests, treatments, admissions, admitted] = await Promise.all([
        prisma.consultation.count(),
        prisma.labReferral.count(),
        prisma.treatmentPlan.count(),
        prisma.admissionRecommendation.count(),
        prisma.admissionRecommendation.count({ where: { status: "admitted" } }),
      ]);
      headers = ["Stage", "Count"];
      rows = [
        ["Consultations", consultations],
        ["Tests advised", tests],
        ["Treatment plans", treatments],
        ["Admissions advised", admissions],
        ["Admitted", admitted],
      ];
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown report type '${type}'` }, { status: 400 });
  }

  return new NextResponse(csv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
