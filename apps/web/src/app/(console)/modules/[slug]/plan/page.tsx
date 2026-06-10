import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getModuleBySlug, resolveFilters, planActivityTypes, getPlanActivityType } from "@/lib/modules/registry";
import { effectiveCan } from "@/lib/modules/access";
import { drillCount } from "@/lib/drill/count";
import { getPlanConfig } from "@/lib/config/actions";
import {
  planProgressPct, activitiesBudget, formatINR, canVerify, canApprove, separationOk,
  cadencePeriods, monthlyBuckets, isBranchScoped, isCompanyScoped, type Cadence,
  type TargetLine, type ActivityLine,
} from "@prm/core";
import { activePlan as governingPlan } from "@/lib/planning/gate";
import { assertModuleAllotted } from "@/lib/modules/allotment";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { FieldInput } from "@/components/masters/FieldInput";
import {
  createModulePlan, createPlanForPeriod, updateModulePlan, setPlanStatus, saveBudgetBreakdown,
  saveTarget, removeTarget, saveActivity, removeActivity, setActivityStatus, pushActivityToTask,
  verifyActivity, approveActivity, rejectActivity, createDraftFromActivity,
} from "@/lib/planning/actions";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";
const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function ModulePlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireCan(def.resource, "view");
  await assertModuleAllotted(user, slug);
  const canEdit = effectiveCan(user, def.resource, "edit");

  // Planning scope: centre staff plan for their own centre; company/group users
  // plan for the centre picked in the switcher, else at company/group level.
  const scopeBranchId = isBranchScoped(user.role) ? user.branchId : user.activeBranchId;
  const planWhere = scopeBranchId
    ? { moduleSlug: slug, branchId: scopeBranchId }
    : isCompanyScoped(user.role)
      ? { moduleSlug: slug, branchId: null, companyId: user.companyId }
      : { moduleSlug: slug, branchId: null, companyId: null };

  const [plans, staff, kpiActuals, cfg, scopeBranch] = await Promise.all([
    prisma.modulePlan.findMany({ where: planWhere, orderBy: { createdAt: "desc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    Promise.all(def.kpis.map((k) => drillCount(k.entity, resolveFilters(k.filters), user))),
    getPlanConfig(slug),
    scopeBranchId ? prisma.branch.findUnique({ where: { id: scopeBranchId } }) : Promise.resolve(null),
  ]);
  const scopeLabel = scopeBranch
    ? `Centre plan — ${scopeBranch.name}`
    : isCompanyScoped(user.role)
      ? "Company plan"
      : "Group plan — all centres";
  // When this centre has no active plan, show which plan currently governs it.
  const governing = scopeBranchId
    ? await governingPlan(slug, { branchId: scopeBranchId, companyId: (scopeBranch?.companyId as string | null) ?? user.companyId })
    : null;
  // Cadence-driven period options for the current + next year (custom → free-form).
  const thisYear = new Date().getFullYear();
  const periodOptions = cfg.cadence === "custom" ? [] : [...cadencePeriods(cfg.cadence as Cadence, thisYear), ...cadencePeriods(cfg.cadence as Cadence, thisYear + 1)];
  const showMonthlyBudget = cfg.cadence === "yearly" && cfg.monthlyBudget;
  const actualByLabel: Record<string, number> = Object.fromEntries(def.kpis.map((k, i) => [k.label, kpiActuals[i]]));
  const active = plans.find((p) => p.status === "active") ?? plans[0] ?? null;
  const history = plans.filter((p) => p.id !== active?.id);
  const ownerName = (id: string | null | undefined) => staff.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title={`Plan · ${def.name}`} subtitle="Objectives, targets, budget, time frame & activities for this department" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/modules/${slug}`} className="text-sm text-slate-500 hover:underline">← {def.name} dashboard</Link>
        <Badge tone={scopeBranch ? "blue" : "slate"}>{scopeLabel}</Badge>
        {!scopeBranch && !isBranchScoped(user.role) && <span className="text-xs text-slate-400">Pick a centre in the header switcher to plan for one centre.</span>}
      </div>

      {!active ? (
        <Card accent>
          {governing && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No active plan for this centre yet — it is currently governed by the {governing.branchId ? "centre" : governing.companyId ? "company" : "group"} plan <b>{governing.title}</b>. Create one below to plan separately.
            </p>
          )}
          <h2 className="mb-3 font-semibold">Create the first plan</h2>
          {canEdit ? (
            periodOptions.length > 0 ? (
              <form action={createPlanForPeriod.bind(null, slug)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className={lab}>Title<input name="title" placeholder={`${def.name} plan`} className={input} /></label>
                <label className={lab}>Period<select name="periodKey" className={input}>{periodOptions.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}</select></label>
                <label className={`${lab} sm:col-span-2`}>Objective<input name="objective" placeholder="What this period aims to achieve" className={input} /></label>
                <label className={lab}>Budget (₹)<input type="number" step="0.01" name="plannedBudget" className={input} /></label>
                <div className="sm:col-span-4"><SubmitButton>Create plan</SubmitButton></div>
                <p className={`${lab} sm:col-span-4 text-slate-400`}>Periods follow the <b>{cfg.cadence.replace("_", "-")}</b> cadence (set under Configure).</p>
              </form>
            ) : (
              <form action={createModulePlan.bind(null, slug)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className={lab}>Title<input name="title" placeholder={`${def.name} plan`} className={input} /></label>
                <label className={lab}>Period<input name="period" placeholder="2026-H1" className={input} /></label>
                <label className={lab}>From<input type="date" name="periodStart" className={input} /></label>
                <label className={lab}>To<input type="date" name="periodEnd" className={input} /></label>
                <label className={`${lab} sm:col-span-3`}>Objective<input name="objective" placeholder="What this period aims to achieve" className={input} /></label>
                <label className={lab}>Budget (₹)<input type="number" step="0.01" name="plannedBudget" className={input} /></label>
                <div className="sm:col-span-4"><SubmitButton>Create plan</SubmitButton></div>
              </form>
            )
          ) : <p className="text-sm text-slate-400">No plan yet for this module.</p>}
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active plan header + status */}
          <Card accent>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2"><h2 className="text-lg font-bold">{active.title}</h2><Badge tone={active.status === "active" ? "green" : active.status === "closed" ? "slate" : "amber"}>{active.status}</Badge></div>
                <div className="text-xs text-slate-500">{active.period ?? "No period"}{active.periodStart ? ` · ${day(active.periodStart)} → ${day(active.periodEnd)}` : ""} · Budget {formatINR(active.plannedBudget)} · Owner {ownerName(active.ownerId)}</div>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  {active.status !== "active" && <form action={setPlanStatus.bind(null, active.id, "active")}><button className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Activate</button></form>}
                  {active.status === "active" && <form action={setPlanStatus.bind(null, active.id, "closed")}><button className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Close</button></form>}
                </div>
              )}
            </div>
            {active.objective && <p className="text-sm text-slate-600">{active.objective}</p>}
            {canEdit && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-400">Edit plan details</summary>
                <form action={updateModulePlan.bind(null, active.id)} className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className={lab}>Title<input name="title" defaultValue={active.title} className={input} /></label>
                  <label className={lab}>Period<input name="period" defaultValue={active.period ?? ""} className={input} /></label>
                  <label className={lab}>From<input type="date" name="periodStart" defaultValue={day(active.periodStart)} className={input} /></label>
                  <label className={lab}>To<input type="date" name="periodEnd" defaultValue={day(active.periodEnd)} className={input} /></label>
                  <label className={`${lab} sm:col-span-3`}>Objective<input name="objective" defaultValue={active.objective ?? ""} className={input} /></label>
                  <label className={lab}>Budget (₹)<input type="number" step="0.01" name="plannedBudget" defaultValue={active.plannedBudget ? active.plannedBudget / 100 : ""} className={input} /></label>
                  <div className="sm:col-span-4"><SubmitButton>Save</SubmitButton></div>
                </form>
              </details>
            )}
          </Card>

          {/* Month-wise budget (yearly cadence + monthly budget) */}
          {showMonthlyBudget && (() => {
            const budgetYear = active.period && /^\d{4}$/.test(active.period) ? parseInt(active.period, 10) : thisYear;
            const breakdown = (active.budgetBreakdown as Record<string, number> | null) ?? {};
            const totalBroken = Object.values(breakdown).reduce((s, v) => s + (v ?? 0), 0);
            return (
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold">Month-wise budget · {budgetYear}</h2>
                  <span className="text-sm text-slate-500">Allocated {formatINR(totalBroken)} of {formatINR(active.plannedBudget)}</span>
                </div>
                {canEdit ? (
                  <form action={saveBudgetBreakdown.bind(null, active.id)} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {monthlyBuckets(budgetYear).map((m) => (
                      <label key={m.label} className={lab}>{m.label.slice(5)}
                        <input type="number" step="0.01" name={`m_${m.label}`} defaultValue={breakdown[m.label] ? breakdown[m.label] / 100 : ""} className={input} />
                      </label>
                    ))}
                    <div className="col-span-3 sm:col-span-6"><SubmitButton>Save budget</SubmitButton></div>
                  </form>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
                    {monthlyBuckets(budgetYear).map((m) => <div key={m.label} className="rounded border border-slate-100 px-2 py-1"><div className="text-xs text-slate-400">{m.label.slice(5)}</div>{breakdown[m.label] ? formatINR(breakdown[m.label]) : "—"}</div>)}
                  </div>
                )}
              </Card>
            );
          })()}

          {/* Targets vs actuals */}
          <Card>
            <h2 className="mb-3 font-semibold">Targets</h2>
            <div className="space-y-2">
              {((active.targets as TargetLine[] | null) ?? []).length === 0 && <p className="text-sm text-slate-400">No targets set.</p>}
              {((active.targets as TargetLine[] | null) ?? []).map((t, i) => {
                const actual = t.kpiLabel != null ? actualByLabel[t.kpiLabel] : undefined;
                const pct = actual != null ? planProgressPct(actual, t.target) : null;
                return (
                  <div key={i} className="rounded border border-slate-100 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.label}{t.kpiLabel ? <span className="ml-1 text-xs text-rose-600">· live KPI</span> : null}</span>
                      <span className="flex items-center gap-2">
                        <span>{actual != null ? `${actual} / ` : ""}{t.target}{t.unit ? ` ${t.unit}` : ""}{pct != null ? ` · ${pct}%` : ""}</span>
                        {canEdit && <form action={removeTarget.bind(null, active.id, i)}><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form>}
                      </span>
                    </div>
                    {pct != null && <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100"><div className="h-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>}
                  </div>
                );
              })}
            </div>
            {canEdit && (
              <form action={saveTarget.bind(null, active.id)} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select name="kpiLabel" className={input}><option value="">Free-form…</option>{def.kpis.map((k) => <option key={k.label} value={k.label}>{k.label} (live)</option>)}</select>
                <input name="label" placeholder="Label (free-form)" className={input} />
                <input name="target" type="number" step="0.01" placeholder="Target" className={input} />
                <div className="flex gap-2"><input name="unit" placeholder="Unit" className={input} /><SubmitButton>Add</SubmitButton></div>
              </form>
            )}
          </Card>

          {/* Activities — 3-step maker-checker-approver */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Activities</h2>
              <span className="text-sm text-slate-500">Planned budget {formatINR(activitiesBudget((active.activities as ActivityLine[] | null) ?? []))} · your rank: {user.planRank}</span>
            </div>
            <div className="space-y-2">
              {((active.activities as ActivityLine[] | null) ?? []).length === 0 && <p className="text-sm text-slate-400">No activities planned.</p>}
              {((active.activities as ActivityLine[] | null) ?? []).map((a, i) => {
                const ap = a.approval ?? { status: "entered" as const };
                const apTone = ap.status === "approved" ? "green" : ap.status === "verified" ? "blue" : ap.status === "rejected" ? "red" : "amber";
                const type = a.typeKey ? getPlanActivityType(slug, a.typeKey) : undefined;
                const isAdmin = user.role === "administrator";
                return (
                  <div key={i} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <Badge tone={apTone}>{ap.status}</Badge>
                        <span className="ml-2 font-medium">{a.title}</span>
                        {type && <span className="ml-1 text-xs text-rose-600">· {type.label}</span>}
                        <span className="ml-2 text-xs text-slate-400">{ownerName(a.ownerId)}{a.dueDate ? ` · due ${a.dueDate}` : ""}{a.budget ? ` · ${formatINR(a.budget)}` : ""}{a.target != null ? ` · target ${a.target}` : ""}</span>
                      </span>
                      {canEdit && (
                        <span className="flex flex-wrap items-center gap-1">
                          {ap.status === "entered" && canVerify(user.planRank) && separationOk("verify", user.id, ap, isAdmin) && <form action={verifyActivity.bind(null, active.id, i)}><button className="rounded border border-blue-200 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50">Verify</button></form>}
                          {ap.status === "verified" && canApprove(user.planRank) && separationOk("approve", user.id, ap, isAdmin) && <form action={approveActivity.bind(null, active.id, i)}><button className="rounded border border-emerald-300 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50">Approve</button></form>}
                          {(ap.status === "entered" || ap.status === "verified") && canVerify(user.planRank) && <form action={rejectActivity.bind(null, active.id, i)}><button className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50">Reject</button></form>}
                          {ap.status === "approved" && type?.createHref && (type.draft
                            ? <form action={createDraftFromActivity.bind(null, active.id, i)}><button className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50">Create draft →</button></form>
                            : <Link href={`${type.createHref}?planRef=${active.id}:${i}`} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50">Do now →</Link>)}
                          {ap.status === "approved" && (a.taskId ? <Link href="/tasks" className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500">Task →</Link> : <form action={pushActivityToTask.bind(null, active.id, i)}><button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Task</button></form>)}
                          <form action={removeActivity.bind(null, active.id, i)}><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form>
                        </span>
                      )}
                    </div>
                    {a.custom && Object.keys(a.custom).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {cfg.entryFields.filter((f) => a.custom?.[f.name] != null && a.custom?.[f.name] !== "").map((f) => (
                          <Badge key={f.name} tone="slate">{f.label}: {String(a.custom?.[f.name]).replace(/_/g, " ")}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400">
                      entered: {ownerName(ap.enteredById)} · verified: {ap.verifiedById ? ownerName(ap.verifiedById) : "—"} · approved: {ap.approvedById ? ownerName(ap.approvedById) : "—"}
                      {ap.note ? ` · note: ${ap.note}` : ""}
                    </div>
                    {(a.changeLog ?? []).length > 0 && (
                      <details className="mt-1"><summary className="cursor-pointer text-[11px] text-slate-400">Change log ({(a.changeLog ?? []).length})</summary>
                        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                          {(a.changeLog ?? []).map((c, j) => <li key={j}>{c.at.slice(0, 16).replace("T", " ")} · {c.action} · {ownerName(c.byId)} ({c.byRank}){c.detail ? ` · ${c.detail}` : ""}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {canEdit && (
              <form action={saveActivity.bind(null, active.id)} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                <select name="typeKey" className={input}><option value="">Free-form…</option>{planActivityTypes(slug).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
                <input name="title" placeholder="Title (optional for typed)" className={`${input} sm:col-span-2`} />
                <input name="target" type="number" placeholder="Target" className={input} />
                <select name="ownerId" className={input}><option value="">Owner…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <div className="flex gap-2"><input type="date" name="dueDate" className={input} /><SubmitButton>Enter</SubmitButton></div>
                {cfg.entryFields.length > 0 && (
                  <div className="sm:col-span-6 mt-1 grid grid-cols-2 gap-2 rounded-md border border-dashed border-slate-200 p-2 sm:grid-cols-4">
                    <div className="sm:col-span-4 text-[11px] font-medium text-slate-500">Custom entry fields</div>
                    {cfg.entryFields.map((f) => <FieldInput key={f.name} field={f} />)}
                  </div>
                )}
              </form>
            )}
            <p className="mt-2 text-[11px] text-slate-400">New activities start <b>entered</b> → a supervisor <b>verifies</b> → a manager <b>approves</b>. Only approved activities can be executed. Edits by supervisors/managers are logged and reset approval.</p>
          </Card>

          {history.length > 0 && (
            <Card>
              <h2 className="mb-2 font-semibold">Plan history</h2>
              <div className="space-y-1 text-sm">
                {history.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
                    <span>{p.title} <span className="text-xs text-slate-400">{p.period ?? ""}</span></span>
                    <span className="flex items-center gap-2"><Badge tone={p.status === "closed" ? "slate" : "amber"}>{p.status}</Badge>{canEdit && p.status !== "active" && <form action={setPlanStatus.bind(null, p.id, "active")}><button className="text-xs text-emerald-700 hover:underline">Make active</button></form>}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canEdit && (
            <details>
              <summary className="cursor-pointer text-sm text-slate-500">+ New plan (next period)</summary>
              <Card>
                {periodOptions.length > 0 ? (
                  <form action={createPlanForPeriod.bind(null, slug)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className={lab}>Title<input name="title" className={input} /></label>
                    <label className={lab}>Period<select name="periodKey" className={input}>{periodOptions.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}</select></label>
                    <label className={`${lab} sm:col-span-2`}>Objective<input name="objective" className={input} /></label>
                    <label className={lab}>Budget (₹)<input type="number" step="0.01" name="plannedBudget" className={input} /></label>
                    <div className="sm:col-span-4"><SubmitButton>Create plan</SubmitButton></div>
                  </form>
                ) : (
                  <form action={createModulePlan.bind(null, slug)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className={lab}>Title<input name="title" className={input} /></label>
                    <label className={lab}>Period<input name="period" placeholder="2026-H2" className={input} /></label>
                    <label className={lab}>From<input type="date" name="periodStart" className={input} /></label>
                    <label className={lab}>To<input type="date" name="periodEnd" className={input} /></label>
                    <label className={`${lab} sm:col-span-3`}>Objective<input name="objective" className={input} /></label>
                    <label className={lab}>Budget (₹)<input type="number" step="0.01" name="plannedBudget" className={input} /></label>
                    <div className="sm:col-span-4"><SubmitButton>Create plan</SubmitButton></div>
                  </form>
                )}
              </Card>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
