"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { logout } from "@/lib/auth-actions";
import { Badge } from "@/components/ui";
import { DrillProvider } from "@/components/drill/DrillProvider";
import { NavIcon, type IconName } from "./NavIcon";
import { DepartmentRail, type RailModule, type UtilityItem } from "./DepartmentRail";
import { CentreSwitcher, type CentreGroup } from "./CentreSwitcher";
import { ModuleTabBar, type ModuleTabBarData } from "./ModuleTabBar";

export type { RailModule, UtilityItem } from "./DepartmentRail";
export type { CentreGroup } from "./CentreSwitcher";
export type { ModuleTabBarData } from "./ModuleTabBar";

const GROUP_ORDER = ["Overview", "Engagement", "Clinical", "Outreach", "Growth", "Workflow", "Admin"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function activeModuleSlug(pathname: string, modules: RailModule[]): string | null {
  const m = modules.find((mod) => [`/modules/${mod.slug}`, ...mod.match].some((p) => matchesPrefix(pathname, p)));
  return m?.slug ?? null;
}

function SideLink({ href, label, icon, active, onNavigate }: { href: string; label: string; icon?: IconName; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        active
          ? "bg-white/20 font-medium text-white shadow-sm ring-1 ring-gold-400/30"
          : "text-rose-100/85 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon && <span className={active ? "text-gold-300" : "text-rose-200/70"}><NavIcon name={icon} /></span>}
      {label}
    </Link>
  );
}

/**
 * The secondary sidebar: ALWAYS the department list (module details only) —
 * a module's own pages live in the ModuleTabBar at the top of its pages.
 */
function SecondaryNav({
  modules,
  utilities,
  pathname,
  onNavigate,
}: {
  modules: RailModule[];
  utilities: UtilityItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const activeSlug = activeModuleSlug(pathname, modules);
  const groups = GROUP_ORDER.filter((g) => modules.some((m) => m.group === g));
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="text-sm font-bold text-rose-50">Sreedhareeyam PRM</div>
        <div className="text-[11px] text-rose-200/70">All departments</div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <SideLink href="/" label="Consolidation" icon="dashboard" active={pathname === "/"} onNavigate={onNavigate} />
        {groups.map((group) => (
          <div key={group}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-200/60">{group}</div>
            <div className="space-y-0.5">
              {modules.filter((m) => m.group === group).map((m) => (
                <SideLink key={m.slug} href={`/modules/${m.slug}`} label={m.name} icon={m.icon} active={m.slug === activeSlug} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        {utilities.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-200/60">Tools</div>
            <div className="space-y-0.5">
              {utilities.map((u) => (
                <SideLink key={u.href} href={u.href} label={u.label} icon={u.icon} active={matchesPrefix(pathname, u.href)} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

export function AppShell({
  modules,
  utilities,
  user,
  todayLabel,
  centreGroups = [],
  activeBranchId = null,
  moduleTab = null,
  children,
}: {
  modules: RailModule[];
  utilities: UtilityItem[];
  user: { name: string; role: string };
  todayLabel: string;
  centreGroups?: CentreGroup[];
  activeBranchId?: string | null;
  moduleTab?: ModuleTabBarData | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const goBack = () => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/"); };
  useEffect(() => { setOpen(false); }, [pathname]);

  const activeSlug = useMemo(() => activeModuleSlug(pathname, modules), [pathname, modules]);
  const isHome = activeSlug === null && !utilities.some((u) => matchesPrefix(pathname, u.href) && u.href !== "/");

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop: department rail + secondary sidebar */}
      <div className="sticky top-0 hidden h-screen lg:flex">
        <DepartmentRail modules={modules} utilities={utilities} activeSlug={activeSlug} isHome={isHome} />
        <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-rose-950 lg:flex">
          <SecondaryNav modules={modules} utilities={utilities} pathname={pathname} />
        </aside>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-rose-950 shadow-xl">
            <SecondaryNav modules={modules} utilities={utilities} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-[var(--background)]/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          {pathname !== "/" && (
            <button
              onClick={goBack}
              aria-label="Back"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-700 dark:bg-gold-700/30 dark:text-gold-300" title="Prototype — data is sample data and resets on restart">Prototype · mock data</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline dark:text-slate-500">Today: {todayLabel}</span>
            {centreGroups.length > 0 && <CentreSwitcher groups={centreGroups} active={activeBranchId} />}
            <span className="text-slate-600 dark:text-slate-300">{user.name}</span>
            <Badge tone="blue">{user.role.replace(/_/g, " ")}</Badge>
            <form action={logout}>
              <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {moduleTab && <ModuleTabBar data={moduleTab} />}
          <DrillProvider>{children}</DrillProvider>
        </main>
      </div>
    </div>
  );
}
