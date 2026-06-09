import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { type Resource } from "@prm/core";
import { AppShell, type RailModule, type UtilityItem } from "@/components/shell/AppShell";
import { type IconName } from "@/components/shell/NavIcon";
import { accessibleModules, effectiveCan, isModuleManager, ownsModule, moduleForPath, defaultWorkspace } from "@/lib/modules/access";

// Two-level navigation: a department rail (one icon per accessible module) plus a
// secondary sidebar that shows the active module's workspace. Department managers
// are confined to the modules they own.

type Utility = { href: string; label: string; icon: IconName; resource: Resource };
const UTILITIES: Utility[] = [
  { href: "/analytics", label: "Analytics", icon: "chart", resource: "dashboards" },
  { href: "/reports", label: "Reports", icon: "report", resource: "reports" },
  { href: "/module-access", label: "Module access", icon: "shield", resource: "masters" },
  { href: "/audit", label: "Audit", icon: "shield", resource: "audit" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pathname = (await headers()).get("x-pathname") ?? "";

  // Confinement: a department manager may only be inside a module they own (or the
  // consolidation home). Anything else bounces to their default workspace.
  if (isModuleManager(user)) {
    const mod = moduleForPath(pathname);
    const onOwnedModule = mod ? ownsModule(user, mod.slug) : false;
    const onHome = pathname === "/" || pathname === "";
    if (!onOwnedModule && !onHome) redirect(defaultWorkspace(user));
  }

  const modules: RailModule[] = accessibleModules(user).map((m) => ({
    slug: m.slug,
    name: m.name,
    icon: m.icon,
    group: m.group,
    match: m.match,
    links: m.links.filter((l) => effectiveCan(user, l.resource, "view")).map((l) => ({ label: l.label, href: l.href })),
  }));

  // Confined managers get no cross-module utility tools; others see what they can view.
  const utilities: UtilityItem[] = isModuleManager(user)
    ? []
    : UTILITIES.filter((u) => effectiveCan(user, u.resource, "view")).map(({ href, label, icon }) => ({ href, label, icon }));

  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AppShell modules={modules} utilities={utilities} user={{ name: user.name, role: user.role }} todayLabel={todayLabel}>
      {children}
    </AppShell>
  );
}
