import { NextRequest, NextResponse } from "next/server";
import { can } from "@prm/core";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

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
