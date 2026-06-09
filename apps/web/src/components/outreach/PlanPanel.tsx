import { formatINR } from "@prm/core";
import { Card, SubmitButton, Badge } from "@/components/ui";
import { updateCampPlan } from "@/lib/outreach/actions";
import type { OutreachEventType } from "@/lib/outreach/metrics";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";

export interface PlanValues {
  location: string | null;
  venue: string | null;
  venueCapacity: number | null;
  diseaseId: string | null;
  branchId: string | null;
  isRecurring: boolean;
  expectedPatients: number | null;
  expectedAdmissions: number | null;
}

export function PlanPanel({ eventType, id, plan, rentPlanned, adPlanned, branches, diseases, canEdit }: {
  eventType: OutreachEventType;
  id: string;
  plan: PlanValues;
  rentPlanned: number;
  adPlanned: number;
  branches: { id: string; name: string }[];
  diseases: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const branchLabel = plan.branchId ? branches.find((b) => b.id === plan.branchId)?.name ?? "Branch" : "Main hospital";
  const diseaseLabel = plan.diseaseId ? diseases.find((d) => d.id === plan.diseaseId)?.name : null;

  if (!canEdit) {
    return (
      <Card accent>
        <h2 className="mb-3 font-semibold">Camp plan</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge tone="slate">{plan.location ?? "No location"}</Badge>
          {plan.venue && <Badge tone="slate">{plan.venue}{plan.venueCapacity ? ` · cap ${plan.venueCapacity}` : ""}</Badge>}
          {diseaseLabel && <Badge tone="amber">{diseaseLabel}</Badge>}
          <Badge tone="blue">Run by {branchLabel}</Badge>
          <Badge tone={plan.isRecurring ? "green" : "slate"}>{plan.isRecurring ? "Recurring" : "One-off"}</Badge>
          {plan.expectedPatients != null && <Badge tone="slate">{plan.expectedPatients} expected</Badge>}
          <Badge tone="slate">Rent {formatINR(rentPlanned)}</Badge>
          <Badge tone="slate">Ads {formatINR(adPlanned)}</Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card accent>
      <h2 className="mb-3 font-semibold">Camp plan</h2>
      <form action={updateCampPlan.bind(null, eventType, id)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className={lab}>Location (locality)<input name="location" defaultValue={plan.location ?? ""} className={input} /></label>
        <label className={lab}>Venue / auditorium<input name="venue" defaultValue={plan.venue ?? ""} className={input} /></label>
        <label className={lab}>Venue capacity<input type="number" name="venueCapacity" defaultValue={plan.venueCapacity ?? ""} className={input} /></label>
        <label className={lab}>Target disease<select name="diseaseId" defaultValue={plan.diseaseId ?? ""} className={input}><option value="">—</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className={lab}>Run by (branch)<select name="branchId" defaultValue={plan.branchId ?? ""} className={input}><option value="">Main hospital</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className={lab}>Expected patients<input type="number" name="expectedPatients" defaultValue={plan.expectedPatients ?? ""} className={input} /></label>
        <label className={lab}>Expected IP admissions<input type="number" name="expectedAdmissions" defaultValue={plan.expectedAdmissions ?? ""} className={input} /></label>
        <label className={lab}>Budgeted rent (₹)<input type="number" step="0.01" name="rentBudget" defaultValue={rentPlanned ? rentPlanned / 100 : ""} className={input} /></label>
        <label className={lab}>Social-ad budget (₹)<input type="number" step="0.01" name="adBudget" defaultValue={adPlanned ? adPlanned / 100 : ""} className={input} /></label>
        <label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" name="isRecurring" defaultChecked={plan.isRecurring} className="h-4 w-4" /> Recurring camp</label>
        <div className="col-span-2 flex items-end sm:col-span-4"><SubmitButton>Save plan</SubmitButton></div>
      </form>
    </Card>
  );
}
