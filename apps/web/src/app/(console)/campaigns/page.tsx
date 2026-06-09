import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createCampaign } from "@/lib/campaigns/actions";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";
import { PlanActivitySelect } from "@/components/planning/PlanActivitySelect";

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
  const rows = await Promise.all(campaigns.map(async (c) => ({ c, k: await computeCampaignKpis(c.id, c.budget, c.launchedAt) })));
  const STATUS_TONE: Record<string, "slate" | "green" | "blue"> = { planned: "slate", running: "green", completed: "blue" };

  return (
    <div>
      <PageHeader title="Outreach campaigns" subtitle="Area → audience → channels & reach → 24h leads → conversion (Module 13)" />

      {can(user.role, "campaigns", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New campaign</h2>
          <form action={createCampaign} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Name<input name="name" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Primary type<select name="type" className={input}>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Budget (₹)<input type="number" step="0.01" name="budget" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Source<select name="sourceId" className={input}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Area<input name="targetLocation" placeholder="e.g. Kochi" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">District<input name="targetDistrict" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Disease focus<input name="targetDisease" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Gender<select name="targetGender" className={input}><option value="all">all</option><option value="female">female</option><option value="male">male</option></select></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Age min<input type="number" name="targetAgeMin" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Age max<input type="number" name="targetAgeMax" className={input} /></label>
            <label className="col-span-2 text-xs font-medium text-slate-600 dark:text-slate-300">Audience / traits<input name="targetAudience" placeholder="e.g. seniors with cataract symptoms" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Start<input type="date" name="startDate" className={input} /></label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">End<input type="date" name="endDate" className={input} /></label>
            <div className="sm:col-span-2"><PlanActivitySelect slug="campaigns" typeKey="launch_campaign" /></div>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Create campaign</SubmitButton><span className="ml-2 text-xs text-slate-400">Add channels &amp; launch on the campaign page.</span></div>
          </form>
        </Card>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr><th className="px-4 py-2">Campaign</th><th className="px-4 py-2">Area · Audience</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Reach</th><th className="px-4 py-2">Leads (24h)</th><th className="px-4 py-2">Spend</th><th className="px-4 py-2">CPL</th><th className="px-4 py-2">ROI</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No campaigns yet.</td></tr>}
            {rows.map(({ c, k }) => (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2"><Link href={`/campaigns/${c.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-400">{c.name}</Link><div className="text-xs text-slate-400">{c.type.replace(/_/g, " ")}</div></td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.targetLocation ?? "—"}{(c.targetAgeMin || c.targetAgeMax) ? <span className="text-xs text-slate-400"> · {c.targetAgeMin ?? ""}–{c.targetAgeMax ?? ""}{c.targetGender && c.targetGender !== "all" ? " " + c.targetGender : ""}</span> : null}</td>
                <td className="px-4 py-2"><Badge tone={STATUS_TONE[c.status] ?? "slate"}>{c.status}</Badge></td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{(k.achievedReach || k.promisedReach).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2"><DrillCount value={k.leads} entity="leads" filters={{ campaignId: c.id }} label={`${c.name} · leads`} /><span className="text-xs text-slate-400"> ({k.leads24h} in 24h)</span></td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{money(k.spend)}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{money(k.costPerLead)}</td>
                <td className="px-4 py-2">{k.roi === null ? "—" : <Badge tone={k.roi >= 0 ? "green" : "red"}>{k.roi}%</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
