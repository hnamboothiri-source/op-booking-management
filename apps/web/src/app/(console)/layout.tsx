import { requireUser } from "@/lib/session";
import { can, type Resource } from "@prm/core";
import { AppShell, type NavItem } from "@/components/shell/AppShell";
import { MODULE_DASHBOARDS } from "@/lib/modules/registry";

// Module-first sidebar: a small Overview group of cross-module utility pages,
// then one entry per module (→ its dashboard) grouped by domain. `match` lets a
// module highlight when the user is deep in one of its sub-pages.
type NavDef = NavItem & { resource: Resource };

const UTILITY: NavDef[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", group: "Overview", resource: "dashboards", match: ["/"] },
  { href: "/analytics", label: "Analytics", icon: "chart", group: "Overview", resource: "dashboards" },
  { href: "/reports", label: "Reports", icon: "report", group: "Overview", resource: "reports" },
  { href: "/audit", label: "Audit", icon: "shield", group: "Admin", resource: "audit" },
];

const MODULE_NAV: NavDef[] = MODULE_DASHBOARDS.map((m) => ({
  href: `/modules/${m.slug}`,
  label: m.name,
  icon: m.icon,
  group: m.group,
  resource: m.resource,
  match: [`/modules/${m.slug}`, ...m.match],
}));

const NAV: NavDef[] = [...UTILITY, ...MODULE_NAV];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Dashboard is visible to everyone logged in; other items respect RBAC.
  const items: NavItem[] = NAV.filter((n) => n.resource === "dashboards" || can(user.role, n.resource, "view"))
    .map(({ href, label, icon, group, match }) => ({ href, label, icon, group, match }));

  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AppShell items={items} user={{ name: user.name, role: user.role }} todayLabel={todayLabel}>
      {children}
    </AppShell>
  );
}
