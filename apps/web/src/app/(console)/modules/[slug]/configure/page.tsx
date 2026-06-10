import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canConfigureModule } from "@/lib/modules/access";
import { assertModuleAllotted } from "@/lib/modules/allotment";
import { getModuleBySlug } from "@/lib/modules/registry";
import { getPlanConfig, getModuleFlow, savePlanConfig, addConfigField, removeConfigField, addFlowStep, updateFlowStep, removeFlowStep, moveFlowStep, resetFlow } from "@/lib/config/actions";
import { cadencePeriods, CADENCES, CADENCE_LABELS, type Cadence } from "@prm/core";
import { PageHeader, Card, SubmitButton, Badge } from "@/components/ui";
import { FieldBuilder } from "@/components/config/FieldBuilder";
import { FlowBuilder } from "@/components/config/FlowBuilder";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";

export default async function ConfigurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = getModuleBySlug(slug);
  if (!def) notFound();
  const user = await requireUser();
  if (!canConfigureModule(user, slug)) redirect("/forbidden");
  await assertModuleAllotted(user, slug);

  const cfg = await getPlanConfig(slug);
  const flow = await getModuleFlow(slug);
  const year = new Date().getFullYear();
  const periods = cadencePeriods(cfg.cadence as Cadence, year);

  return (
    <div>
      <PageHeader title={`Configure · ${def.name}`} subtitle="Planning cadence, plan entry fields & report columns for this department" />
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/modules/${slug}`} className="text-sm text-slate-500 hover:underline">← {def.name} dashboard</Link>
        <Link href={`/modules/${slug}/masters`} className="text-sm text-rose-600 hover:underline">Masters →</Link>
      </div>

      <div className="space-y-4">
        {/* Cadence */}
        <Card accent>
          <h3 className="font-semibold">Planning cadence</h3>
          <p className="mt-0.5 text-xs text-slate-500">How this module's plans are segmented. Each plan a manager creates targets one of these periods.</p>
          <form action={savePlanConfig.bind(null, slug)} className="mt-3 flex flex-wrap items-end gap-3">
            <label className={lab}>Cadence
              <select name="cadence" defaultValue={cfg.cadence} className={input}>
                {CADENCES.map((c) => <option key={c} value={c}>{CADENCE_LABELS[c]}</option>)}
              </select>
            </label>
            <label className={`${lab} flex items-center gap-2 pb-1.5`}>
              <input type="checkbox" name="monthlyBudget" defaultChecked={cfg.monthlyBudget} className="h-4 w-4" />
              Month-wise budget breakdown (yearly)
            </label>
            <SubmitButton>Save cadence</SubmitButton>
          </form>
          <div className="mt-3">
            <div className="text-xs font-medium text-slate-600">Periods for {year} ({CADENCE_LABELS[cfg.cadence as Cadence]}):</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {periods.length === 0
                ? <span className="text-xs text-slate-400">Custom — periods are entered free-form on the Plan page.</span>
                : periods.map((p) => <Badge key={p.label} tone="blue">{p.label}</Badge>)}
            </div>
          </div>
        </Card>

        <FieldBuilder
          title="Plan entry fields"
          hint="Extra fields captured on each plan activity. Stored per activity and shown in reports if selected below."
          fields={cfg.entryFields}
          addAction={addConfigField.bind(null, slug, "entryFields")}
          removeAction={removeConfigField.bind(null, slug, "entryFields")}
        />

        <FieldBuilder
          title="Report columns"
          hint="Custom columns shown on this module's report, read from each activity's entry fields."
          fields={cfg.reportColumns}
          addAction={addConfigField.bind(null, slug, "reportColumns")}
          removeAction={removeConfigField.bind(null, slug, "reportColumns")}
        />

        <FlowBuilder
          def={def}
          steps={flow}
          isOverride={cfg.flowSteps.length > 0}
          addAction={addFlowStep.bind(null, slug)}
          updateAction={updateFlowStep.bind(null, slug)}
          removeAction={removeFlowStep.bind(null, slug)}
          moveAction={moveFlowStep.bind(null, slug)}
          resetAction={resetFlow.bind(null, slug)}
        />
      </div>
    </div>
  );
}
