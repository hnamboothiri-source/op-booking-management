import Link from "next/link";
import type { DrillFilters } from "@prm/core";

const humanize = (s: string) => s.replace(/_/g, " ");

/**
 * Banner shown on a list page when a drill-down filter is active, with a
 * one-click clear back to the unfiltered list. Server component (just links).
 */
export function ActiveFilters({ filters, basePath }: { filters: DrillFilters; basePath: string }) {
  const entries = Object.entries(filters).filter(([, v]) => v?.trim().length > 0);
  if (entries.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm dark:border-rose-900 dark:bg-rose-950/40">
      <span className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">Filtered</span>
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {humanize(k)}: <span className="font-medium">{humanize(v)}</span>
        </span>
      ))}
      <Link href={basePath} className="ml-auto text-xs font-medium text-rose-700 hover:underline dark:text-rose-400">
        Clear ✕
      </Link>
    </div>
  );
}
