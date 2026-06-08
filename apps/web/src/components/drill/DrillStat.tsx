"use client";

import type { DrillEntity, DrillFilters } from "@prm/core";
import { useDrill } from "./DrillProvider";

/**
 * A clickable KPI tile. Renders like the existing `Card` number blocks but opens
 * the drill drawer for `entity` filtered by `filters`. Use for the big metric
 * tiles on dashboards and list-page summaries.
 */
export function DrillStat({
  label,
  value,
  entity,
  filters,
}: {
  label: string;
  value: React.ReactNode;
  entity: DrillEntity;
  filters: DrillFilters;
}) {
  const { openDrill } = useDrill();
  return (
    <button
      type="button"
      onClick={() => openDrill({ entity, filters, label })}
      className="group block rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" aria-hidden>⤢</span>
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </button>
  );
}
