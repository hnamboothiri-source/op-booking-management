import {
  STAFF_ROLES,
  REVENUE_KINDS,
  PLANNING_STEPS,
  onSiteRevenue,
  formatINR,
  type OutreachStaffLine,
  type OutreachRevenueLine,
  type PlanningChecklist,
} from "@prm/core";
import { Card, SubmitButton } from "@/components/ui";
import { saveStaffLine, removeStaffLine, saveRevenueLine, removeRevenueLine, updatePlanning } from "@/lib/outreach/actions";
import type { OutreachEventType } from "@/lib/outreach/metrics";

const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const roleLabel = (v: string) => STAFF_ROLES.find((r) => r.value === v)?.label ?? v;
const kindLabel = (v: string) => REVENUE_KINDS.find((k) => k.value === v)?.label ?? v;

export function PlanningSection({ eventType, id, planning, canEdit }: {
  eventType: OutreachEventType; id: string; planning: PlanningChecklist; canEdit: boolean;
}) {
  const done = PLANNING_STEPS.filter((s) => planning[s.key]).length;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Planning checklist</h2>
        <span className="text-sm text-slate-500">{done}/{PLANNING_STEPS.length} done</span>
      </div>
      <form action={updatePlanning.bind(null, eventType, id)} className="space-y-2">
        {PLANNING_STEPS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name={s.key} defaultChecked={!!planning[s.key]} disabled={!canEdit} className="rounded border-slate-300" />
            {s.label}
          </label>
        ))}
        {canEdit && <div className="pt-1"><SubmitButton>Save planning</SubmitButton></div>}
      </form>
    </Card>
  );
}

export function RosterSection({ eventType, id, roster, canEdit }: {
  eventType: OutreachEventType; id: string; roster: OutreachStaffLine[]; canEdit: boolean;
}) {
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Staff roster</h2>
      <div className="space-y-1">
        {roster.length === 0 && <p className="text-sm text-slate-400">No staff assigned yet.</p>}
        {roster.map((s, i) => (
          <div key={i} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm">
            <span>{roleLabel(s.role)}{s.name ? ` · ${s.name}` : ""}</span>
            <span className="flex items-center gap-2"><span className="text-slate-500">{formatINR(s.honorarium)}</span>
              {canEdit && <form action={removeStaffLine.bind(null, eventType, id, i)}><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form>}
            </span>
          </div>
        ))}
      </div>
      {canEdit && (
        <form action={saveStaffLine.bind(null, eventType, id)} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select name="role" className={input}>{STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          <input name="name" placeholder="Name (optional)" className={input} />
          <input name="honorarium" type="number" step="0.01" placeholder="Bata / honorarium ₹" className={input} />
          <SubmitButton>Add staff</SubmitButton>
        </form>
      )}
    </Card>
  );
}

export function RevenueSection({ eventType, id, lines, canEdit }: {
  eventType: OutreachEventType; id: string; lines: OutreachRevenueLine[]; canEdit: boolean;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">On-site revenue</h2>
        <span className="text-sm font-medium text-emerald-600">{formatINR(onSiteRevenue(lines))}</span>
      </div>
      <div className="space-y-1">
        {lines.length === 0 && <p className="text-sm text-slate-400">No on-site income recorded.</p>}
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm">
            <span>{kindLabel(l.kind)}{l.note ? <span className="ml-1 text-xs text-slate-400">· {l.note}</span> : null}</span>
            <span className="flex items-center gap-2"><span className="text-slate-600">{formatINR(l.amount)}</span>
              {canEdit && <form action={removeRevenueLine.bind(null, eventType, id, i)}><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form>}
            </span>
          </div>
        ))}
      </div>
      {canEdit && (
        <form action={saveRevenueLine.bind(null, eventType, id)} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select name="kind" className={input}>{REVENUE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <input name="amount" type="number" step="0.01" placeholder="Amount ₹" className={input} />
          <input name="note" placeholder="Note" className={input} />
          <SubmitButton>Add income</SubmitButton>
        </form>
      )}
    </Card>
  );
}
