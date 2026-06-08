"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/auth-actions";
import { Badge } from "@/components/ui";
import { DrillProvider } from "@/components/drill/DrillProvider";
import { NavIcon, type IconName } from "./NavIcon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  group: string;
  /** Extra route prefixes that should mark this item active (e.g. a module's sub-pages). */
  match?: string[];
}

const GROUP_ORDER = ["Overview", "Engagement", "Clinical", "Outreach", "Growth", "Workflow", "Admin"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = item.match && item.match.length ? item.match : [item.href];
  return prefixes.some((p) => matchesPrefix(pathname, p));
}

function NavList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const groups = GROUP_ORDER.filter((g) => items.some((i) => i.group === g));
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group}>
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group}</div>
          <div className="space-y-0.5">
            {items.filter((i) => i.group === group).map((i) => {
              const active = isActive(pathname, i);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-rose-50 font-medium text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span className={active ? "text-rose-700 dark:text-rose-300" : "text-slate-400 dark:text-slate-500"}>
                    <NavIcon name={i.icon} />
                  </span>
                  {i.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-700 to-gold-500 text-sm font-bold text-white">S</span>
      <div className="leading-tight">
        <div className="text-sm font-bold text-rose-800 dark:text-rose-200">Sreedhareeyam PRM</div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500">Patient Relationship Mgmt</div>
      </div>
    </div>
  );
}

export function AppShell({ items, user, todayLabel, children }: { items: NavItem[]; user: { name: string; role: string }; todayLabel: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <Brand />
        <NavList items={items} pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl dark:bg-slate-900">
            <Brand />
            <NavList items={items} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-[var(--background)]/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-medium text-gold-700 dark:bg-gold-700/30 dark:text-gold-300" title="Prototype — data is sample data and resets on restart">Prototype · mock data</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline dark:text-slate-500">Today: {todayLabel}</span>
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
          <DrillProvider>{children}</DrillProvider>
        </main>
      </div>
    </div>
  );
}
