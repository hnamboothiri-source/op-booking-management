"use client";

import Link from "next/link";
import type { ModuleInfo, BuildStatus } from "@/lib/blueprint";
import { useDrill } from "@/components/drill/DrillProvider";

const STATUS_STYLE: Record<BuildStatus, string> = {
  done: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
const STATUS_LABEL: Record<BuildStatus, string> = { done: "Done", in_progress: "In progress", planned: "Planned" };

/**
 * Dashboard module tile. Clicking opens the drill drawer for the module's
 * record entity (preview + "View full list →"); modules without a single
 * entity navigate to their page instead.
 */
export function ModuleCard({ module: m }: { module: ModuleInfo }) {
  const { openDrill } = useDrill();
  const shell = "group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700";

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-slate-400">{m.id} · Phase {m.phase}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
      </div>
      <h3 className="mt-1 flex items-center gap-1 font-semibold">
        {m.name}
        <span className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" aria-hidden>›</span>
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.summary}</p>
    </>
  );

  if (m.drill) {
    return (
      <button type="button" onClick={() => openDrill({ entity: m.drill!, filters: {}, label: m.name })} className={shell}>
        {inner}
      </button>
    );
  }
  return <Link href={m.href} className={shell}>{inner}</Link>;
}
