"use client";

import type { DrillEntity, DrillFilters } from "@prm/core";
import { useDrill } from "./DrillProvider";

/**
 * A clickable KPI tile — gradient top accent, uppercase label, large value, and
 * an optional sub line. Opens the drill drawer for `entity` filtered by
 * `filters`. Used across dashboards and list-page summaries.
 */
export function DrillStat({
  label,
  value,
  entity,
  filters,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  entity: DrillEntity;
  filters: DrillFilters;
  sub?: React.ReactNode;
}) {
  const { openDrill } = useDrill();
  return (
    <button
      type="button"
      onClick={() => openDrill({ entity, filters, label })}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700"
    >
      <div className="h-1 bg-gradient-to-r from-rose-700 to-gold-500" />
      <div className="p-4">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <span>{label}</span>
          <span className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>›</span>
        </div>
        <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
    </button>
  );
}
