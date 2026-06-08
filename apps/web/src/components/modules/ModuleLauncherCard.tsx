import Link from "next/link";
import { NavIcon } from "@/components/shell/NavIcon";
import type { ModuleDef } from "@/lib/modules/registry";

/** Home master-grid tile: module name + headline KPI, opens the module dashboard. */
export function ModuleLauncherCard({ def, value }: { def: ModuleDef; value: number | null }) {
  return (
    <Link
      href={`/modules/${def.slug}`}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700"
    >
      <div className="h-1 bg-gradient-to-r from-rose-700 to-gold-500" />
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          <NavIcon name={def.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-semibold text-slate-800 group-hover:text-rose-700 dark:text-slate-100 dark:group-hover:text-rose-300">
            {def.name}<span className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </div>
          {def.headline && value !== null
            ? <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold text-slate-700 dark:text-slate-200">{value.toLocaleString("en-IN")}</span> {def.headline.label.toLowerCase()}</div>
            : <div className="mt-0.5 text-xs text-slate-400">Open dashboard</div>}
        </div>
      </div>
    </Link>
  );
}
