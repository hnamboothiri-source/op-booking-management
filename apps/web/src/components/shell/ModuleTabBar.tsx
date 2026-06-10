"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type IconName } from "./NavIcon";

export interface ModuleTab {
  label: string;
  href: string;
}

export interface ModuleTabBarData {
  slug: string;
  name: string;
  icon: IconName;
  items: ModuleTab[];
}

/**
 * The module's connection pages, shown horizontally at the top of every page
 * belonging to the module (the left panel only lists departments).
 */
export function ModuleTabBar({ data }: { data: ModuleTabBarData }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === `/modules/${data.slug}` ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className="mb-5 rounded-xl border border-rose-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5">
        <span className="mr-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          <NavIcon name={data.icon} />
          {data.name}
        </span>
        {data.items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-sm transition-colors ${
              isActive(t.href)
                ? "bg-rose-600 font-medium text-white"
                : "text-slate-600 hover:bg-rose-50 hover:text-rose-800 dark:text-slate-300 dark:hover:bg-rose-950/40"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
