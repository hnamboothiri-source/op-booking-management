import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { PageHeader, Card, Badge } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";

export const dynamic = "force-dynamic";
const money = (p: number | null) => (p === null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCan("campaigns", "view");
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();
  const k = await computeCampaignKpis(campaign.id, campaign.budget);

  const tiles = [
    { label: "Spend", value: money(k.spend) },
    { label: "Leads", value: k.leads },
    { label: "Consultations", value: k.consultations },
    { label: "Admissions", value: k.admissions },
    { label: "Revenue", value: money(k.revenue) },
    { label: "Cost / lead", value: money(k.costPerLead) },
    { label: "Cost / consultation", value: money(k.costPerConsultation) },
    { label: "Cost / admission", value: money(k.costPerAdmission) },
  ];

  return (
    <div>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.type.replace(/_/g, " ")}${campaign.targetLocation ? ` · ${campaign.targetLocation}` : ""}${campaign.targetDisease ? ` · ${campaign.targetDisease}` : ""}`}
        action={k.roi === null ? <Badge>ROI —</Badge> : <Badge tone={k.roi >= 0 ? "green" : "red"}>ROI {k.roi}%</Badge>}
      />
      <div className="mb-6"><Link href="/campaigns" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Campaigns</Link></div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Leads" value={k.leads} entity="leads" filters={{ campaignId: id }} />
        {tiles.filter((t) => t.label !== "Leads").map((t) => (
          <Card key={t.label}><div className="text-xl font-bold">{t.value}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.label}</div></Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Funnel attributed via leads tagged to this campaign → their bookings → consultations → admitted admissions.
        Revenue = admitted-package estimated cost; ROI = (revenue − spend) / spend.
      </p>
    </div>
  );
}
