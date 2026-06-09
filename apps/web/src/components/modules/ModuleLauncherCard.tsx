import Link from "next/link";
import { NavIcon } from "@/components/shell/NavIcon";
import type { ModuleDef } from "@/lib/modules/registry";

/** Home rollup tile: module name + icon + its key KPI numbers, opens the module dashboard. */
export function ModuleLauncherCard({ def, kpis }: { def: ModuleDef; kpis: { label: string; value: number }[] }) {
  return (
    <Link
      href={`/modules/${def.slug}`}
      className="group block overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm transition-colors hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700"
    >
      <div className="h-1 bg-gradient-to-r from-rose-600 to-gold-500" />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-600 transition-colors group-hover:border-rose-300 group-hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300">
            <NavIcon name={def.icon} />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1 font-semibold text-slate-800 group-hover:text-rose-700 dark:text-slate-100 dark:group-hover:text-rose-300">
            {def.name}<span className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
          </div>
        </div>
        {kpis.length > 0 ? (
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-900/50">
                <dd className="text-lg font-bold leading-none text-slate-800 dark:text-slate-100">{k.value.toLocaleString("en-IN")}</dd>
                <dt className="mt-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">{k.label}</dt>
              </div>
            ))}
          </dl>
        ) : (
          <div className="mt-3 text-xs text-slate-400">Open dashboard →</div>
        )}
      </div>
    </Link>
  );
}
