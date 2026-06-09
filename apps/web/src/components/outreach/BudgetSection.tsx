import { EXPENSE_CATEGORIES, budgetTotals, formatINR, type OutreachExpenseLine, type OutreachStaffLine } from "@prm/core";
import { Card, SubmitButton } from "@/components/ui";
import { saveBudgetLine, removeBudgetLine } from "@/lib/outreach/actions";
import type { OutreachEventType } from "@/lib/outreach/metrics";

const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const label = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export function BudgetSection({ eventType, id, expenses, roster, canEdit }: {
  eventType: OutreachEventType;
  id: string;
  expenses: OutreachExpenseLine[];
  roster: OutreachStaffLine[];
  canEdit: boolean;
}) {
  const t = budgetTotals(expenses, roster);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Budget — planned vs actual</h2>
        <span className={`text-sm font-medium ${t.variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
          {t.variance > 0 ? "Over" : "Under"} by {formatINR(Math.abs(t.variance))}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-400">
          <tr><th className="py-1">Category</th><th className="py-1 text-right">Planned</th><th className="py-1 text-right">Actual</th><th className="py-1 text-right">Variance</th>{canEdit && <th />}</tr>
        </thead>
        <tbody>
          {expenses.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="py-2 text-slate-400">No expense lines yet.</td></tr>}
          {expenses.map((e, i) => {
            const v = (e.actual ?? 0) - e.planned;
            return (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5">{label(e.category)}{e.note ? <span className="ml-1 text-xs text-slate-400">· {e.note}</span> : null}</td>
                <td className="py-1.5 text-right">{formatINR(e.planned)}</td>
                <td className="py-1.5 text-right">{e.actual != null ? formatINR(e.actual) : "—"}</td>
                <td className={`py-1.5 text-right ${v > 0 ? "text-red-600" : v < 0 ? "text-emerald-600" : "text-slate-400"}`}>{e.actual != null ? formatINR(v) : "—"}</td>
                {canEdit && <td className="py-1.5 text-right"><form action={removeBudgetLine.bind(null, eventType, id, i)}><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form></td>}
              </tr>
            );
          })}
          <tr className="border-t border-slate-200 font-medium">
            <td className="py-1.5">Staff honoraria</td>
            <td className="py-1.5 text-right">{formatINR(t.staffCost)}</td>
            <td className="py-1.5 text-right">{formatINR(t.staffCost)}</td>
            <td className="py-1.5 text-right text-slate-400">—</td>{canEdit && <td />}
          </tr>
          <tr className="border-t-2 border-slate-300 font-bold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{formatINR(t.plannedTotal)}</td>
            <td className="py-2 text-right">{formatINR(t.actualTotal)}</td>
            <td className="py-2 text-right">{formatINR(t.variance)}</td>{canEdit && <td />}
          </tr>
        </tbody>
      </table>

      {canEdit && (
        <form action={saveBudgetLine.bind(null, eventType, id)} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <select name="category" className={input}>{EXPENSE_CATEGORIES.filter((c) => c.value !== "staff_honorarium").map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <input name="planned" type="number" step="0.01" placeholder="Planned ₹" className={input} />
          <input name="actual" type="number" step="0.01" placeholder="Actual ₹" className={input} />
          <input name="note" placeholder="Note" className={input} />
          <SubmitButton>Add line</SubmitButton>
        </form>
      )}
    </Card>
  );
}
