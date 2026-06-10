/**
 * Admin builder for a module's operator flow (Configure page). Mirrors
 * FieldBuilder: per-row remove + up/down + inline edit, and an add-row form.
 * No client state — every control is a server-action form. Dropdowns are
 * sourced from the module's own KPIs + link hrefs so steps stay safe.
 */
import { Card, SubmitButton, Badge } from "@/components/ui";
import { FLOW_PHASES, FLOW_PHASE_LABELS, FLOW_PHASE_TONE } from "@prm/core";
import { moduleFlowHrefs, FLOW_ICONS, type ModuleDef, type FlowStep } from "@/lib/modules/registry";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";

function StepFields({ def, step }: { def: ModuleDef; step?: FlowStep }) {
  const hrefs = moduleFlowHrefs(def.slug);
  return (
    <>
      <label className={`${lab} sm:col-span-2`}>Title<input name="title" required defaultValue={step?.title ?? ""} placeholder="New leads waiting" className={input} /></label>
      <label className={`${lab} sm:col-span-2`}>Description<input name="description" defaultValue={step?.description ?? ""} placeholder="What to do here" className={input} /></label>
      <label className={lab}>Live count (KPI)
        <select name="kpiLabel" defaultValue={step?.kpiLabel ?? ""} className={input}>
          <option value="">— none —</option>
          {def.kpis.map((k) => <option key={k.label} value={k.label}>{k.label}</option>)}
        </select>
      </label>
      <label className={lab}>Link
        <select name="href" defaultValue={step?.href ?? ""} className={input}>
          <option value="">— none —</option>
          {hrefs.map((h) => <option key={h.href} value={h.href}>{h.label}</option>)}
        </select>
      </label>
      <label className={lab}>Button label<input name="actionLabel" defaultValue={step?.actionLabel ?? ""} placeholder="Open →" className={input} /></label>
      <label className={lab}>Phase
        <select name="phase" defaultValue={step?.phase ?? ""} className={input}>
          <option value="">— none (flat) —</option>
          {FLOW_PHASES.map((p) => <option key={p} value={p}>{FLOW_PHASE_LABELS[p]}</option>)}
        </select>
      </label>
      <label className={lab}>Icon
        <select name="icon" defaultValue={step?.icon ?? ""} className={input}>
          <option value="">— none —</option>
          {FLOW_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
        </select>
      </label>
    </>
  );
}

export function FlowBuilder({
  def,
  steps,
  isOverride,
  addAction,
  updateAction,
  removeAction,
  moveAction,
  resetAction,
}: {
  def: ModuleDef;
  steps: FlowStep[];
  isOverride: boolean;
  addAction: (fd: FormData) => Promise<void>;
  updateAction: (index: number, fd: FormData) => Promise<void>;
  removeAction: (index: number) => Promise<void>;
  moveAction: (index: number, dir: "up" | "down") => Promise<void>;
  resetAction: () => Promise<void>;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Operator flow (Guide)</h3>
          <p className="mt-0.5 text-xs text-slate-500">The ordered Start → Result journey shown on the dashboard strip & the Guide page.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={isOverride ? "blue" : "slate"}>{isOverride ? "Custom" : "Using default"}</Badge>
          {isOverride && <form action={resetAction}><SubmitButton tone="ghost">Reset to default</SubmitButton></form>}
        </div>
      </div>
      {!isOverride && <p className="mt-2 text-xs text-amber-600">Showing the built-in flow. Editing creates a custom override for this department.</p>}

      <ol className="mt-3 space-y-2">
        {steps.length === 0 && <li className="text-sm text-slate-400">No steps.</li>}
        {steps.map((s, i) => (
          <li key={i} className="rounded-md border border-slate-200 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">{i + 1}</span>
                <span className="font-medium">{s.title}</span>
                {s.phase && <span className="ml-2"><Badge tone={FLOW_PHASE_TONE[s.phase]}>{FLOW_PHASE_LABELS[s.phase]}</Badge></span>}
                {s.kpiLabel && <span className="ml-2 text-xs text-rose-600">· {s.kpiLabel}</span>}
                {s.href && <span className="ml-2 text-xs text-slate-400">→ {s.href}</span>}
              </span>
              <span className="flex items-center gap-1">
                <form action={moveAction.bind(null, i, "up")}><button className="rounded border border-slate-200 px-1.5 py-0.5 text-xs hover:bg-slate-50" aria-label="Move up">↑</button></form>
                <form action={moveAction.bind(null, i, "down")}><button className="rounded border border-slate-200 px-1.5 py-0.5 text-xs hover:bg-slate-50" aria-label="Move down">↓</button></form>
                <form action={removeAction.bind(null, i)}><SubmitButton tone="danger">Remove</SubmitButton></form>
              </span>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-slate-400">Edit step</summary>
              <form action={updateAction.bind(null, i)} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StepFields def={def} step={s} />
                <div className="sm:col-span-4"><SubmitButton>Save step</SubmitButton></div>
              </form>
            </details>
          </li>
        ))}
      </ol>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-rose-700">+ Add step</summary>
        <form action={addAction} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StepFields def={def} />
          <div className="sm:col-span-4"><SubmitButton>Add step</SubmitButton></div>
        </form>
      </details>
    </Card>
  );
}
