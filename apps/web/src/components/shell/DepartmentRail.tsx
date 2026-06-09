"use client";

import Link from "next/link";
import { NavIcon, type IconName } from "./NavIcon";

export interface RailModule {
  slug: string;
  name: string;
  icon: IconName;
  group: string;
  match: string[];
  links: { label: string; href: string }[];
}

export interface UtilityItem {
  href: string;
  label: string;
  icon: IconName;
}

const GROUP_ORDER = ["Overview", "Engagement", "Clinical", "Outreach", "Growth", "Workflow", "Admin"];

function RailButton({ href, icon, label, active }: { href: string; icon: IconName; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
        active
          ? "bg-white/20 text-white shadow-sm ring-1 ring-gold-400/40"
          : "text-rose-100/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <NavIcon name={icon} />
      <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-rose-950 px-2 py-1 text-xs text-white shadow-lg ring-1 ring-white/15 group-hover:block">
        {label}
      </span>
    </Link>
  );
}

/**
 * Thin department rail: Home (consolidation) + one icon per accessible module,
 * grouped by domain with subtle dividers, then utility/admin icons at the foot.
 */
export function DepartmentRail({
  modules,
  utilities,
  activeSlug,
  isHome,
}: {
  modules: RailModule[];
  utilities: UtilityItem[];
  activeSlug: string | null;
  isHome: boolean;
}) {
  const groups = GROUP_ORDER.filter((g) => modules.some((m) => m.group === g));
  return (
    <div className="flex h-full w-16 flex-col items-center gap-1 border-r border-white/10 bg-rose-950 py-3">
      <Link
        href="/"
        title="All departments"
        aria-label="All departments"
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
          isHome ? "bg-gradient-to-br from-rose-500 to-gold-500 text-white shadow-sm" : "text-gold-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        S
      </Link>
      <div className="my-1 h-px w-7 bg-white/10" />

      <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={group} className="flex flex-col items-center gap-1">
            {gi > 0 && <div className="my-1 h-px w-7 bg-white/10" />}
            {modules.filter((m) => m.group === group).map((m) => (
              <RailButton key={m.slug} href={`/modules/${m.slug}`} icon={m.icon} label={m.name} active={activeSlug === m.slug} />
            ))}
          </div>
        ))}
      </div>

      {utilities.length > 0 && (
        <>
          <div className="my-1 h-px w-7 bg-white/10" />
          <div className="flex flex-col items-center gap-1">
            {utilities.map((u) => (
              <RailButton key={u.href} href={u.href} icon={u.icon} label={u.label} active={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
