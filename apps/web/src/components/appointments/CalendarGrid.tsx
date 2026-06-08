import Link from "next/link";
import type { CalendarLayout, CalendarCellState } from "@prm/core";

const STATE_TONE: Record<CalendarCellState, string> = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  booked: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800",
  full: "bg-gold-100 text-gold-700 border-gold-300 dark:bg-gold-700/30 dark:text-gold-300 dark:border-gold-700",
  blocked: "bg-slate-100 text-slate-400 border-slate-200 line-through dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700",
};

/**
 * Renders a column × time-row calendar grid from a pre-computed CalendarLayout.
 * Columns are doctors / rooms / branches / week-days; cells are slot or booking
 * chips tinted by state and linked where a target exists.
 */
export function CalendarGrid({ layout, columnLabels }: { layout: CalendarLayout; columnLabels: Record<string, string> }) {
  const { columns, times, grid } = layout;
  if (columns.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No slots for this view. Generate slots on the Schedules page.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900">
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-medium uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">Time</th>
            {columns.map((c) => (
              <th key={c} className="min-w-[120px] px-3 py-2 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{columnLabels[c] ?? c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={t} className="border-t border-slate-100 align-top dark:border-slate-700">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t}</td>
              {columns.map((c) => {
                const items = grid[c]?.[t] ?? [];
                return (
                  <td key={c} className="px-2 py-1.5">
                    <div className="flex flex-col gap-1">
                      {items.map((it) => {
                        const cls = `block rounded border px-2 py-1 text-xs ${STATE_TONE[it.state]}`;
                        const body = <>{it.label ?? it.state}{it.endTime ? <span className="ml-1 opacity-60">{it.startTime}–{it.endTime}</span> : null}</>;
                        return it.href ? <Link key={it.id} href={it.href} className={cls}>{body}</Link> : <span key={it.id} className={cls}>{body}</span>;
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
