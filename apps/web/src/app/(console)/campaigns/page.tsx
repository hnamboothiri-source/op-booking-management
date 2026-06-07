import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createCampaign } from "@/lib/campaigns/actions";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const TYPES = ["facebook_ads", "google_ads", "newspaper", "tv", "radio", "whatsapp", "camp", "doctor_referral", "corporate"];
const money = (p: number | null) => (p === null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);

export default async function Campaigns() {
  const user = await requireCan("campaigns", "view");
  const [campaigns, sources] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.leadSourceMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const rows = await Promise.all(campaigns.map(async (c) => ({ c, k: await computeCampaignKpis(c.id, c.budget) })));

  return (
    <div>
      <PageHeader title="Marketing campaigns" subtitle="Measure spend → leads → admissions → ROI (Module 13)" />

      {can(user.role, "campaigns", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New campaign</h2>
          <form action={createCampaign} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="name" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Type<select name="type" className={input}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Budget (₹)<input type="number" step="0.01" name="budget" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Source<select name="sourceId" className={input}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Target location<input name="targetLocation" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Target disease<input name="targetDisease" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Start<input type="date" name="startDate" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">End<input type="date" name="endDate" className={input} /></label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Create campaign</SubmitButton></div>
          </form>
        </Card>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Campaign</th><th className="px-4 py-2">Spend</th><th className="px-4 py-2">Leads</th><th className="px-4 py-2">Consults</th><th className="px-4 py-2">Admits</th><th className="px-4 py-2">CPL</th><th className="px-4 py-2">CPA</th><th className="px-4 py-2">ROI</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No campaigns yet.</td></tr>}
            {rows.map(({ c, k }) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/campaigns/${c.id}`} className="font-medium text-emerald-700 hover:underline">{c.name}</Link><div className="text-xs text-slate-400">{c.type.replace(/_/g, " ")}</div></td>
                <td className="px-4 py-2">{money(k.spend)}</td>
                <td className="px-4 py-2">{k.leads}</td>
                <td className="px-4 py-2">{k.consultations}</td>
                <td className="px-4 py-2">{k.admissions}</td>
                <td className="px-4 py-2">{money(k.costPerLead)}</td>
                <td className="px-4 py-2">{money(k.costPerAdmission)}</td>
                <td className="px-4 py-2">{k.roi === null ? "—" : <Badge tone={k.roi >= 0 ? "green" : "red"}>{k.roi}%</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
