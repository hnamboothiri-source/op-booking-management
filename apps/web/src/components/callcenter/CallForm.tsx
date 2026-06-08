import { recordCall } from "@/lib/calls/actions";
import { deskLabel } from "@prm/core";
import { Card, SubmitButton, Badge } from "@/components/ui";

const CALL_OUTCOMES = ["appointment_booked", "follow_up_required", "not_reachable", "call_later", "asked_for_doctor_details", "asked_for_treatment_cost", "interested_in_branch_visit", "interested_in_admission", "not_interested"];
const SECTION_LABEL: Record<string, string> = { identity: "Identity", clinical: "Clinical", commercial: "Commercial", next_step: "Next step", general: "General" };
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const lbl = "block text-xs font-medium text-slate-600 dark:text-slate-300";

export interface ChecklistItem {
  id: string; label: string; desk?: string | null; section?: string | null;
  promptHint?: string | null; mandatory?: boolean | null; responseType?: string | null;
}

/** Structured call-capture form (checklist + outcome + notes) for a lead or follow-up. */
export default function CallForm({
  items, desk, leadId, patientMrd, followUpId, followUpMode,
}: {
  items: ChecklistItem[];
  desk: string;
  leadId?: string;
  patientMrd?: string | null;
  followUpId?: string;
  followUpMode?: boolean;
}) {
  // Group items by section, preserving the (already sorted) order.
  const sections: { key: string; items: ChecklistItem[] }[] = [];
  for (const it of items) {
    const key = it.section ?? "general";
    let g = sections.find((s) => s.key === key);
    if (!g) { g = { key, items: [] }; sections.push(g); }
    g.items.push(it);
  }

  return (
    <form action={recordCall} className="space-y-6">
      <input type="hidden" name="desk" value={desk} />
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      {patientMrd && <input type="hidden" name="patientMrd" value={patientMrd} />}
      {followUpId && <input type="hidden" name="followUpId" value={followUpId} />}
      <input type="hidden" name="itemIds" value={items.map((i) => i.id).join(",")} />

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold">Call checklist</h2>
          <Badge tone="slate">{deskLabel(desk)}</Badge>
        </div>
        {items.length === 0 && <p className="text-sm text-slate-400">No checklist items configured for this desk. Add them under Masters → Call Checklist Item.</p>}
        <div className="space-y-5">
          {sections.map((s) => (
            <div key={s.key}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{SECTION_LABEL[s.key] ?? s.key}</div>
              <div className="space-y-3">
                {s.items.map((it) => {
                  const rt = it.responseType ?? "checkbox";
                  return (
                    <div key={it.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-start gap-2">
                        {rt === "checkbox" && <input type="checkbox" name={`done_${it.id}`} required={!!it.mandatory} className="mt-0.5 h-4 w-4" />}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{it.label}{it.mandatory && <span className="text-red-500"> *</span>}</div>
                          {it.promptHint && <div className="text-xs text-slate-400">{it.promptHint}</div>}
                          {rt === "yes_no_na" && (
                            <select name={`value_${it.id}`} required={!!it.mandatory} defaultValue="" className={input}>
                              <option value="">— select —</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                              <option value="na">N/A</option>
                            </select>
                          )}
                          {rt === "short_text" && <input name={`value_${it.id}`} required={!!it.mandatory} placeholder="Answer" className={input} />}
                          <input name={`note_${it.id}`} placeholder="Note (optional)" className={`${input} mt-2`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Call outcome</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className={lbl}>Outcome<select name="outcome" className={input}>{CALL_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select></label>
          <label className={lbl}>Duration (min)<input type="number" name="durationMin" min="0" className={input} /></label>
          {followUpMode
            ? <label className={lbl}>Follow-up status<select name="status" defaultValue="" className={input}><option value="">— unchanged —</option><option value="done">done</option><option value="missed">missed</option></select></label>
            : <label className={lbl}>Next follow-up date<input type="date" name="followUpDate" className={input} /></label>}
          <label className={`${lbl} col-span-2 sm:col-span-3`}>Next action<input name="nextAction" placeholder="e.g. send WhatsApp brochure, call back Friday" className={input} /></label>
          <label className={`${lbl} col-span-2 sm:col-span-3`}>Call notes<textarea name="notes" rows={3} className={input} /></label>
        </div>
        <div className="mt-4"><SubmitButton>Save call</SubmitButton></div>
      </Card>
    </form>
  );
}
