import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeCampaignKpis } from "@/lib/campaigns/metrics";
import { addCampaignChannel, setAchievedReach, launchCampaign, completeCampaign, updateCampaignPlan, removeCampaignChannel } from "@/lib/campaigns/actions";
import { CAMPAIGN_CHANNELS, can, campaignPlanTotals } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { DrillCount } from "@/components/drill/DrillCount";
import { BarChartCard } from "@/components/charts/BarChartCard";

export const dynamic = "force-dynamic";
const money = (p: number | null) => (p === null ? "—" : `₹${(p / 100).toLocaleString("en-IN")}`);
const num = (n: number) => n.toLocaleString("en-IN");
const input = "rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const STATUS_TONE: Record<string, "slate" | "green" | "blue"> = { planned: "slate", running: "green", completed: "blue" };

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("campaigns", "view");
  const canEdit = can(user.role, "campaigns", "edit");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { channels: true } as any }) as any;
  if (!campaign) notFound();
  const [k, leads, channelMasters] = await Promise.all([
    computeCampaignKpis(campaign.id, campaign.budget, campaign.launchedAt),
    prisma.lead.findMany({ where: { campaignId: id }, select: { responseChannel: true } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.marketingChannelMaster.findMany({ where: { active: true } as any, include: { offers: true } as any, orderBy: { name: "asc" } }) as any,
  ]);
  const channels: { id: string; channel: string; promisedReach: number; achievedReach: number | null; quotedCost: number }[] = campaign.channels ?? [];

  // Build channel-master picker labels with rate + active-offer flag.
  const now = new Date();
  const rupees = (p: number) => `₹${(p / 100).toLocaleString("en-IN")}`;
  const masterOptions = (channelMasters as { id: string; name: string; pricingModel: string; baseRate: number; offers?: { fromDate: string | Date; toDate: string | Date; active: boolean; name: string }[] }[]).map((m) => {
    const offer = (m.offers ?? []).find((o) => o.active && new Date(o.fromDate) <= now && now <= new Date(o.toDate));
    const rateLabel = m.pricingModel === "cpm" ? `${rupees(m.baseRate)}/1k` : m.pricingModel === "flat" ? `${rupees(m.baseRate)} flat` : `${rupees(m.baseRate)}/${m.pricingModel === "cpc" ? "click" : "post"}`;
    return { id: m.id, label: `${m.name} · ${rateLabel}${offer ? ` · 🎉 ${offer.name}` : ""}` };
  });

  // Response-channel breakdown (step 8).
  const byChannel: Record<string, number> = {};
  for (const l of leads) byChannel[l.responseChannel ?? "unknown"] = (byChannel[l.responseChannel ?? "unknown"] ?? 0) + 1;

  const reach = k.achievedReach || k.promisedReach;
  const cpm = (c: { quotedCost: number; achievedReach: number | null; promisedReach: number }) => {
    const r = c.achievedReach || c.promisedReach;
    return r > 0 ? `₹${Math.round((c.quotedCost / r) * 1000 / 100).toLocaleString("en-IN")}` : "—";
  };

  const tiles = [
    { label: "Promised reach", value: num(k.promisedReach) },
    { label: "Achieved reach", value: num(k.achievedReach) },
    { label: "Reach → lead", value: `${k.reachToLead}%` },
    { label: "Cost / 1k reach", value: money(k.costPerReach) },
    { label: "Spend", value: money(k.spend) },
    { label: "ROI", value: k.roi === null ? "—" : `${k.roi}%` },
  ];

  const planned = campaign.status === "planned";
  const plan = campaignPlanTotals(channels, campaign.budget);
  const dateVal = (d: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const fieldLbl = "text-xs font-medium text-slate-600 dark:text-slate-300";

  // Shared channel-plan table (Remove during planning; Achieved-reach entry after launch).
  const channelsTable = (mode: "plan" | "results") => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr><th className="px-4 py-2">Channel</th><th className="px-4 py-2">Promised reach</th><th className="px-4 py-2">{mode === "plan" ? "Quoted cost" : "Achieved reach"}</th><th className="px-4 py-2">{mode === "plan" ? "Cost / 1k" : "Quoted cost"}</th><th className="px-4 py-2">{mode === "plan" ? "" : "Cost / 1k"}</th></tr></thead>
        <tbody>
          {channels.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">No channels yet{mode === "plan" ? " — add one below." : "."}</td></tr>}
          {channels.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
              <td className="px-4 py-2 capitalize">{c.channel.replace(/_/g, " ")}</td>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{num(c.promisedReach)}</td>
              {mode === "plan" ? (
                <>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{money(c.quotedCost)}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{cpm(c)}</td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && <form action={removeCampaignChannel.bind(null, c.id, id)}><button className="rounded border border-slate-300 px-1.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-slate-600">Remove</button></form>}
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <form action={setAchievedReach.bind(null, c.id, id)} className="flex items-center gap-1">
                        <input name="achievedReach" type="number" defaultValue={c.achievedReach ?? ""} className={`${input} w-24`} />
                        <button className="rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">Save</button>
                      </form>
                    ) : (c.achievedReach != null ? num(c.achievedReach) : "—")}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{money(c.quotedCost)}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{cpm(c)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const addChannelForm = canEdit && (
    <>
      <form action={addCampaignChannel.bind(null, id)} className="mt-3 flex flex-wrap items-end gap-2">
        {masterOptions.length > 0 ? (
          <label className={fieldLbl}>Channel<select name="channelMasterId" className={`${input} block`}>{masterOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        ) : (
          <label className={fieldLbl}>Channel<select name="channel" className={`${input} block`}>{CAMPAIGN_CHANNELS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</select></label>
        )}
        <label className={fieldLbl}>Promised reach<input name="promisedReach" type="number" className={`${input} block w-28`} /></label>
        <label className={fieldLbl}>Quoted cost (₹)<input name="quotedCost" type="number" step="0.01" placeholder="auto" className={`${input} block w-28`} /></label>
        <SubmitButton tone="ghost">Add channel</SubmitButton>
      </form>
      <p className="mt-1 text-xs text-slate-400">Leave quoted cost blank to auto-quote from the channel rate &amp; active seasonal offer. <Link href="/masters/marketing-channels" className="text-rose-600 hover:underline dark:text-rose-400">Channel rates →</Link></p>
    </>
  );

  const plannedTotals = (
    <Card>
      <h2 className="mb-3 font-semibold">Planned totals</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-slate-500">Total promised reach</dt><dd className="font-medium">{num(plan.promisedReach)}</dd>
        <dt className="text-slate-500">Total quoted cost</dt><dd className="font-medium">{money(plan.quotedCost)}</dd>
        <dt className="text-slate-500">Budget</dt><dd>{money(campaign.budget)}</dd>
        <dt className="text-slate-500">Budget used</dt><dd>{plan.budgetUsedPct === null ? "—" : <Badge tone={plan.overBudget ? "red" : "green"}>{plan.budgetUsedPct}%</Badge>}</dd>
      </dl>
      {plan.overBudget && <p className="mt-2 text-xs text-red-600">⚠ Quoted cost exceeds the campaign budget.</p>}
    </Card>
  );

  const areaAudienceCard = (
    <Card>
      <h2 className="mb-3 font-semibold">Area &amp; audience</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-slate-500">Area</dt><dd>{campaign.targetLocation ?? "—"}{campaign.targetDistrict ? `, ${campaign.targetDistrict}` : ""}</dd>
        <dt className="text-slate-500">Disease focus</dt><dd>{campaign.targetDisease ?? "—"}</dd>
        <dt className="text-slate-500">Age</dt><dd>{campaign.targetAgeMin ?? "—"}–{campaign.targetAgeMax ?? "—"}</dd>
        <dt className="text-slate-500">Gender</dt><dd className="capitalize">{campaign.targetGender ?? "all"}</dd>
        <dt className="text-slate-500">Audience</dt><dd>{campaign.targetAudience ?? "—"}</dd>
        <dt className="text-slate-500">Launched</dt><dd>{campaign.launchedAt ? dateVal(campaign.launchedAt) : "not launched"}</dd>
      </dl>
    </Card>
  );

  const responsesCard = (
    <Card>
      <h2 className="mb-3 font-semibold">Responses (leads)</h2>
      <div className="mb-3 flex gap-6">
        <div><div className="text-2xl font-bold">{k.leads24h}</div><div className="text-xs text-slate-500 dark:text-slate-400">within 24h of launch</div></div>
        <div><div className="text-2xl font-bold">{k.leads}</div><div className="text-xs text-slate-500 dark:text-slate-400">total leads</div></div>
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">By response channel</div>
      <div className="mt-1 flex flex-wrap gap-2 text-sm">
        {Object.entries(byChannel).length === 0 ? <span className="text-slate-400">No leads yet.</span> : Object.entries(byChannel).map(([ch, n]) => (
          <span key={ch} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{ch.replace(/_/g, " ")}: <strong>{n}</strong></span>
        ))}
      </div>
      <div className="mt-3"><LinkButton href="/back-office" tone="ghost">Work these leads in the call centre →</LinkButton></div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.type.replace(/_/g, " ")}${campaign.targetLocation ? ` · ${campaign.targetLocation}` : ""}`}
        action={<div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[campaign.status] ?? "slate"}>{campaign.status}</Badge>
          {canEdit && planned && channels.length > 0 && <form action={launchCampaign.bind(null, id)}><SubmitButton>Launch</SubmitButton></form>}
          {canEdit && campaign.status === "running" && <form action={completeCampaign.bind(null, id)}><SubmitButton tone="ghost">Complete</SubmitButton></form>}
        </div>}
      />
      <div className="mb-6"><Link href="/campaigns" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Campaigns</Link></div>

      {planned ? (
        <>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Plan</h2>
            <span className="text-xs text-slate-400">Set the area, audience, channels &amp; reach — then launch.</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold">Area &amp; audience</h2>
              {canEdit ? (
                <form action={updateCampaignPlan.bind(null, id)} className="grid grid-cols-2 gap-3">
                  <label className={fieldLbl}>Area<input name="targetLocation" defaultValue={campaign.targetLocation ?? ""} className={`${input} mt-1 block w-full`} /></label>
                  <label className={fieldLbl}>District<input name="targetDistrict" defaultValue={campaign.targetDistrict ?? ""} className={`${input} mt-1 block w-full`} /></label>
                  <label className={fieldLbl}>Disease focus<input name="targetDisease" defaultValue={campaign.targetDisease ?? ""} className={`${input} mt-1 block w-full`} /></label>
                  <label className={fieldLbl}>Gender<select name="targetGender" defaultValue={campaign.targetGender ?? "all"} className={`${input} mt-1 block w-full`}><option value="all">all</option><option value="female">female</option><option value="male">male</option></select></label>
                  <label className={fieldLbl}>Age min<input type="number" name="targetAgeMin" defaultValue={campaign.targetAgeMin ?? ""} className={`${input} mt-1 block w-full`} /></label>
                  <label className={fieldLbl}>Age max<input type="number" name="targetAgeMax" defaultValue={campaign.targetAgeMax ?? ""} className={`${input} mt-1 block w-full`} /></label>
                  <label className={`${fieldLbl} col-span-2`}>Audience / traits<input name="targetAudience" defaultValue={campaign.targetAudience ?? ""} className={`${input} mt-1 block w-full`} /></label>
                  <label className={fieldLbl}>Budget (₹)<input type="number" step="0.01" name="budget" defaultValue={campaign.budget ? campaign.budget / 100 : ""} className={`${input} mt-1 block w-full`} /></label>
                  <div />
                  <label className={fieldLbl}>Start<input type="date" name="startDate" defaultValue={dateVal(campaign.startDate)} className={`${input} mt-1 block w-full`} /></label>
                  <label className={fieldLbl}>End<input type="date" name="endDate" defaultValue={dateVal(campaign.endDate)} className={`${input} mt-1 block w-full`} /></label>
                  <div className="col-span-2"><SubmitButton tone="ghost">Save plan</SubmitButton></div>
                </form>
              ) : areaAudienceCard}
            </Card>
            {plannedTotals}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Channels &amp; assured reach</h2>
            {channelsTable("plan")}
            {addChannelForm}
            {channels.length === 0 && <p className="mt-2 text-xs text-amber-600">Add at least one channel to enable Launch.</p>}
          </div>

          <p className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400 dark:border-slate-700">Responses &amp; the conversion funnel appear here after you launch the campaign.</p>
        </>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <DrillStat label="Leads (24h)" value={`${k.leads24h}`} entity="leads" filters={{ campaignId: id }} />
            {tiles.map((t) => <Card key={t.label}><div className="text-xl font-bold">{t.value}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.label}</div></Card>)}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {areaAudienceCard}
            {responsesCard}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Channels &amp; assured reach</h2>
            {channelsTable("results")}
            {addChannelForm}
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Plan: <strong>{num(plan.promisedReach)}</strong> promised reach · <strong>{money(plan.quotedCost)}</strong> quoted vs <strong>{money(campaign.budget)}</strong> budget{plan.budgetUsedPct === null ? "" : ` (${plan.budgetUsedPct}%)`}.</div>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Conversion funnel</h2>
            <Card>
              <BarChartCard data={[{ label: "Leads", value: k.leads }, { label: "24h leads", value: k.leads24h }, { label: "Consulted", value: k.consultations }, { label: "Admitted", value: k.admissions }]} height={150} />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Reach <strong>{num(reach)}</strong> → <DrillCount value={`${k.leads} leads`} entity="leads" filters={{ campaignId: id }} label="Campaign leads" /> ({k.reachToLead}% of reach) → {k.consultations} consulted → {k.admissions} admitted · revenue {money(k.revenue)} · ROI {k.roi === null ? "—" : `${k.roi}%`}. Conversion is the call-centre team&apos;s job.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
