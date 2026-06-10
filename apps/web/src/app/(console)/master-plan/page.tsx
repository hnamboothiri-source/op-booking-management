import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatINR, isBranchScoped, planProgressPct,
  quarterSplit, monthsFromQuarters, weeklyAvg, activityTotalsByModule, allotmentSummary,
  type MasterPlanLine, type MasterPlanActivity,
} from "@prm/core";
import { requireUser } from "@/lib/session";
import { canUseTool } from "@/lib/tools";
import { prisma } from "@/lib/db";
import { MODULE_DASHBOARDS } from "@/lib/modules/registry";
import { centreSetCount } from "@/lib/consolidation/rollup";
import { resolveFilters } from "@/lib/modules/registry";
import { saveMasterPlan, canEditMasterPlan } from "@/lib/masterplan/actions";
import { addMasterActivity, updateMasterActivity, removeMasterActivity } from "@/lib/masterplan/activityActions";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DottedAccent } from "@/components/DottedAccent";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const cellInput = "w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs";
const lab = "text-xs font-medium text-slate-600 dark:text-slate-300";

/**
 * Master planning — the budgetary vision statement. Expected business worth for
 * the year per module, quarters adjustable, months & weeks derived. Department
 * managers adopt their allocation on their module's Plan page; this page reads
 * their planned figures back against the vision.
 */
export default async function MasterPlanPage({ searchParams }: { searchParams: Promise<{ scope?: string; year?: string }> }) {
  const user = await requireUser();
  if (!canUseTool(user, "master-plan", "dashboards")) redirect("/forbidden");
  if (isBranchScoped(user.role) && !user.designationTools?.includes("master-plan")) redirect("/");
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const year = parseInt(sp.year ?? "", 10) || thisYear;

  const companies = await prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  // Scope: group, or one company. Company managers land on their own company.
  const requested = sp.scope ?? (user.role === "company_manager" && user.companyId ? user.companyId : "group");
  const companyId = requested === "group" ? null : companies.find((c) => c.id === requested)?.id ?? null;
  const scopeKey = companyId ?? "group";
  const scopeLabel = companyId ? (companies.find((c) => c.id === companyId)?.shortName as string) ?? "Company" : "Sreedhareeyam Group";

  const [plan, branches, modulePlans, catalogue] = await Promise.all([
    prisma.masterPlan.findFirst({ where: { year, companyId } }),
    prisma.branch.findMany({ where: { active: true } }),
    prisma.modulePlan.findMany({ where: { status: "active" } }),
    prisma.activityMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const lines = ((plan?.lines as unknown as MasterPlanLine[] | null) ?? []);
  const visionActivities = ((plan?.activities as unknown as MasterPlanActivity[] | null) ?? []);
  const activityTotals = activityTotalsByModule(visionActivities);
  const lineFor = (slug: string) => lines.find((l) => l.moduleSlug === slug) ?? null;
  const editable = await canEditMasterPlan(user, companyId);

  // Scope sets for performance reading: company scope = its plans + its centres' plans.
  const companyBranchIds = companyId ? branches.filter((b) => b.companyId === companyId).map((b) => b.id) : [];
  const inScope = (p: { branchId: string | null; companyId: string | null }) => {
    if (!companyId) return true; // group vision reads every department plan
    return p.companyId === companyId || (p.branchId != null && companyBranchIds.includes(p.branchId));
  };
  const deptPlanned = (slug: string) =>
    modulePlans.filter((p) => p.moduleSlug === slug && inScope({ branchId: p.branchId ?? null, companyId: p.companyId ?? null }))
      .reduce((s, p) => s + (p.plannedBudget ?? 0), 0);

  // Live KPI actuals for lines that link a target to a module KPI.
  const kpiActuals = new Map<string, number>();
  await Promise.all(lines.filter((l) => l.kpiLabel && l.yearlyTarget).map(async (l) => {
    const kpi = MODULE_DASHBOARDS.find((m) => m.slug === l.moduleSlug)?.kpis.find((k) => k.label === l.kpiLabel);
    if (!kpi) return;
    kpiActuals.set(l.moduleSlug, await centreSetCount(kpi.entity, resolveFilters(kpi.filters), companyId ? companyBranchIds : []));
  }));

  // Target-first: the declared figure drives the strip; allotments distribute it.
  const summary = allotmentSummary((plan?.targetValue as number | undefined) ?? 0, lines);
  const allotTone = summary.remaining === 0 && summary.target > 0 ? "text-emerald-700" : summary.remaining < 0 ? "text-red-700" : "text-amber-700";

  return (
    <main>
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-rose-100 bg-rose-50/60 px-6 py-7">
        <DottedAccent className="opacity-70" />
        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{scopeLabel} · {year}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{plan?.title ?? `Master plan — Vision ${year}`}</h1>
        {plan?.vision && <p className="mt-2 max-w-3xl italic text-slate-600 dark:text-slate-400">“{plan.vision}”</p>}
      </header>

      {/* Scope + year pickers */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {[{ id: "group", label: "Group" }, ...companies.map((c) => ({ id: c.id, label: (c.code ?? c.shortName) as string }))].map((s) => (
          <Link key={s.id} href={`/master-plan?scope=${s.id}&year=${year}`} className={`rounded-full px-3 py-1 ${scopeKey === s.id ? "bg-rose-600 font-medium text-white" : "border border-slate-300 text-slate-600 hover:bg-rose-50"}`}>{s.label}</Link>
        ))}
        <span className="mx-2 text-slate-300">|</span>
        {[thisYear, thisYear + 1].map((y) => (
          <Link key={y} href={`/master-plan?scope=${scopeKey}&year=${y}`} className={`rounded-full px-3 py-1 ${year === y ? "bg-slate-800 font-medium text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{y}</Link>
        ))}
        {!editable && <Badge tone="slate">read only — set by {companyId ? "the company manager" : "group directors"}</Badge>}
      </div>

      {/* Target-first strip: the targeted figure, what's allotted, what remains; quarter/month/week derive from the target */}
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card accent><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Target · {year}</div><div className="mt-1 text-2xl font-bold">{formatINR(summary.target)}</div></Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Allotted to departments</div>
          <div className={`mt-1 text-2xl font-bold ${allotTone}`}>{formatINR(summary.allocated)}</div>
          {summary.pct != null && <div className="text-xs text-slate-400">{summary.pct}% of target{summary.remaining < 0 ? " · over-allotted" : ""}</div>}
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining to allot</div>
          <div className={`mt-1 text-2xl font-bold ${allotTone}`}>{formatINR(summary.remaining)}</div>
          {summary.remaining < 0 && <Badge tone="red">over-allotted</Badge>}
        </Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Per quarter</div><div className="mt-1 text-xl font-bold">{formatINR(Math.round(summary.target / 4))}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Per month</div><div className="mt-1 text-xl font-bold">{formatINR(Math.round(summary.target / 12))}</div></Card>
        <Card><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Per week</div><div className="mt-1 text-xl font-bold">{formatINR(weeklyAvg(summary.target))}</div></Card>
      </section>

      {/* Vision + allocation editor (one form) */}
      <form action={saveMasterPlan}>
        <input type="hidden" name="year" value={year} />
        {companyId && <input type="hidden" name="companyId" value={companyId} />}

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Budgetary vision statement</h2>
            {editable && <SubmitButton>Save master plan</SubmitButton>}
          </div>
          <fieldset disabled={!editable} className="grid gap-3">
            <label className={`${lab} max-w-sm`}>
              <span className="text-sm font-semibold text-rose-800 dark:text-rose-300">Step 1 — Targeted business for the year (₹)</span>
              <input name="targetValue" type="number" step="0.01" defaultValue={summary.target ? summary.target / 100 : ""} placeholder="e.g. 2000000" className={`${input} text-lg font-semibold`} />
            </label>
            <label className={lab}>Title<input name="title" defaultValue={plan?.title ?? `${scopeLabel} — Vision ${year}`} className={input} /></label>
            <label className={lab}>Vision statement<textarea name="vision" rows={2} defaultValue={plan?.vision ?? ""} placeholder="What this year's business should achieve, in one or two sentences." className={input} /></label>
          </fieldset>
          <div className="mt-3 text-sm font-semibold text-rose-800 dark:text-rose-300">Step 2 — Allot the target to departments (₹ amount, or just a % of the target)</div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1 pr-2">Department</th>
                  <th className="py-1 pr-2 text-right">Allotment (₹)</th>
                  <th className="py-1 pr-2 text-right">% of target</th>
                  <th className="py-1 pr-2 text-right">Q1</th><th className="py-1 pr-2 text-right">Q2</th><th className="py-1 pr-2 text-right">Q3</th><th className="py-1 pr-2 text-right">Q4</th>
                  <th className="py-1 pr-2 text-right">/month</th><th className="py-1 pr-2 text-right">/week</th>
                  <th className="py-1 pr-2 text-right">Target</th>
                  <th className="py-1 pr-2 text-right">Dept planned</th>
                  <th className="py-1">% of vision</th>
                </tr>
              </thead>
              <tbody>
                {MODULE_DASHBOARDS.filter((m) => m.group !== "Admin").map((m) => {
                  const l = lineFor(m.slug);
                  const q = l ? quarterSplit(l) : null;
                  const months = q ? monthsFromQuarters(q) : null;
                  const planned = deptPlanned(m.slug);
                  const pct = l && l.yearlyValue > 0 ? planProgressPct(planned, l.yearlyValue) : null;
                  const actual = kpiActuals.get(m.slug);
                  return (
                    <tr key={m.slug} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-1.5 pr-2">
                        <Link href={`/modules/${m.slug}/plan`} className="font-medium hover:underline">{m.name}</Link>
                        {l?.kpiLabel && l.yearlyTarget != null && (
                          <div className="text-[11px] text-slate-400">{l.kpiLabel}: {actual ?? 0} / {l.yearlyTarget}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right"><input name={`val:${m.slug}`} type="number" step="0.01" defaultValue={l ? l.yearlyValue / 100 : ""} disabled={!editable} className={cellInput} /></td>
                      <td className="py-1.5 pr-2 text-right">
                        <input name={`pct:${m.slug}`} type="number" step="0.1" placeholder={l && summary.target > 0 ? String(Math.round((l.yearlyValue / summary.target) * 1000) / 10) : ""} disabled={!editable} className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs" />
                      </td>
                      {(["q1", "q2", "q3", "q4"] as const).map((qk) => (
                        <td key={qk} className="py-1.5 pr-2 text-right">
                          <input name={`${qk}:${m.slug}`} type="number" step="0.01" defaultValue={l?.quarters ? l.quarters[qk] / 100 : ""} placeholder={q ? String(q[qk] / 100) : ""} disabled={!editable} className={cellInput} />
                        </td>
                      ))}
                      <td className="py-1.5 pr-2 text-right text-xs text-slate-500">{months ? formatINR(Math.round(months.reduce((s, v) => s + v, 0) / 12)) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right text-xs text-slate-500">{l ? formatINR(weeklyAvg(l.yearlyValue)) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right"><input name={`target:${m.slug}`} type="number" defaultValue={l?.yearlyTarget ?? ""} disabled={!editable} className="w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-xs" />
                        <input type="hidden" name={`kpi:${m.slug}`} value={l?.kpiLabel ?? m.kpis[0]?.label ?? ""} /></td>
                      <td className="py-1.5 pr-2 text-right">{planned > 0 ? formatINR(planned) : "—"}</td>
                      <td className="py-1.5">
                        {pct != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded bg-slate-100"><div className="h-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                            <span className="text-xs text-slate-500">{pct}%</span>
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={`mt-2 text-sm font-medium ${allotTone}`}>
            Allotted {formatINR(summary.allocated)} of the {formatINR(summary.target)} target — {summary.remaining < 0 ? `over-allotted by ${formatINR(-summary.remaining)}` : `remaining ${formatINR(summary.remaining)}`}{summary.pct != null ? ` (${summary.pct}%)` : ""}.
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Enter the ₹ allotment, or just a “% of target” (₹ wins when both are given). Quarters left blank split the allotment evenly; months and weeks derive automatically. Department managers adopt their allocation on each module&apos;s Plan page — “Dept planned” reads their active plans back against this vision.
          </p>
          {editable && <div className="mt-3"><SubmitButton>Save master plan</SubmitButton></div>}
        </Card>
      </form>

      {/* Reverse plan: the activities expected to achieve the worth */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Activities — how the worth is achieved</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/master-plan/activities" className="text-rose-700 hover:underline dark:text-rose-300">Activity master →</Link>
            <Link href="/master-plan/variance" className="text-rose-700 hover:underline dark:text-rose-300">Variance report →</Link>
          </div>
        </div>
        {!plan ? (
          <Card><p className="text-sm text-slate-400">Save the master plan above first — then list the activities that will achieve the worth.</p></Card>
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr><th className="py-1 pr-2">Activity</th><th className="py-1 pr-2">Department</th><th className="py-1 pr-2 text-right">Count</th><th className="py-1 pr-2 text-right">Expected return (₹)</th><th className="py-1 pr-2 text-right">Expected cost (₹)</th><th className="py-1 pr-2">Quarter</th><th className="py-1" /></tr>
              </thead>
              <tbody>
                {visionActivities.length === 0 && <tr><td className="py-2 text-slate-400" colSpan={7}>No activities yet — add the first one below.</td></tr>}
                {visionActivities.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-1.5 pr-2 font-medium">{a.name}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{MODULE_DASHBOARDS.find((m) => m.slug === a.moduleSlug)?.name ?? a.moduleSlug}</td>
                    {editable ? (
                      <td className="py-1.5 pr-2" colSpan={4}>
                        <form action={updateMasterActivity.bind(null, plan.id, a.id)} className="flex flex-wrap items-center justify-end gap-1.5">
                          <input name="count" type="number" min={1} defaultValue={a.count} title="Count" className="w-14 rounded border border-slate-300 px-1.5 py-1 text-right text-xs" />
                          <input name="expectedValue" type="number" step="0.01" defaultValue={a.expectedValue / 100} title="Expected return ₹" className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs" />
                          <input name="expectedCost" type="number" step="0.01" defaultValue={a.expectedCost / 100} title="Expected cost ₹" className="w-24 rounded border border-slate-300 px-1.5 py-1 text-right text-xs" />
                          <select name="quarter" defaultValue={a.quarter ?? ""} className="rounded border border-slate-300 px-1 py-1 text-xs"><option value="">any</option><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select>
                          <SubmitButton>Save</SubmitButton>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="py-1.5 pr-2 text-right">{a.count}</td>
                        <td className="py-1.5 pr-2 text-right">{formatINR(a.expectedValue)}</td>
                        <td className="py-1.5 pr-2 text-right">{formatINR(a.expectedCost)}</td>
                        <td className="py-1.5 pr-2">{a.quarter ?? "any"}</td>
                      </>
                    )}
                    <td className="py-1.5 text-right">
                      {editable && <form action={removeMasterActivity.bind(null, plan.id, a.id)}><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Coverage: do the activities add up to the allocations? */}
            {Object.keys(activityTotals).length > 0 && (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs dark:border-slate-700">
                {Object.entries(activityTotals).map(([slug, t]) => {
                  const lineValue = lineFor(slug)?.yearlyValue ?? 0;
                  const pct = lineValue > 0 ? planProgressPct(t.value, lineValue) : null;
                  return (
                    <div key={slug} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{MODULE_DASHBOARDS.find((m) => m.slug === slug)?.name ?? slug}:</span>
                      <span>{t.count} activities expect {formatINR(t.value)} at cost {formatINR(t.cost)}</span>
                      {pct != null
                        ? <span className={pct >= 100 ? "text-emerald-700" : "text-amber-700"}>— covers {pct}% of the {formatINR(lineValue)} allocation</span>
                        : <span className="text-slate-400">— no allocation set for this department</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {editable && (
              <form action={addMasterActivity.bind(null, plan.id)} className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-6 dark:border-slate-700">
                <label className={`${lab} sm:col-span-2`}>Activity (from the master)
                  <select name="activityMasterId" required className={input}>
                    <option value="">— pick from the catalogue —</option>
                    {catalogue.map((c) => <option key={c.id} value={c.id}>{c.name} ({MODULE_DASHBOARDS.find((m) => m.slug === c.moduleSlug)?.name ?? c.moduleSlug} · {formatINR(c.expectedValue)} / {formatINR(c.expectedCost)} per unit)</option>)}
                  </select>
                </label>
                <label className={lab}>Count<input name="count" type="number" min={1} defaultValue={1} className={input} /></label>
                <label className={lab}>Return ₹ (blank = auto)<input name="expectedValue" type="number" step="0.01" className={input} /></label>
                <label className={lab}>Cost ₹ (blank = auto)<input name="expectedCost" type="number" step="0.01" className={input} /></label>
                <label className={lab}>Quarter<select name="quarter" className={input}><option value="">any</option><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option></select></label>
                <div className="sm:col-span-6"><SubmitButton>Add activity</SubmitButton></div>
              </form>
            )}
          </Card>
        )}
      </section>
    </main>
  );
}
