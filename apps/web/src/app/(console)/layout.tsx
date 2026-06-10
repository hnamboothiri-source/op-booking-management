import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isBranchScoped, isCompanyScoped, type Resource } from "@prm/core";
import { prisma } from "@/lib/db";
import { AppShell, type CentreGroup, type RailModule, type UtilityItem } from "@/components/shell/AppShell";
import { type IconName } from "@/components/shell/NavIcon";
import { accessibleModules, effectiveCan, isModuleManager, ownsModule, moduleForPath, defaultWorkspace } from "@/lib/modules/access";
import { allowedModuleSlugsFor } from "@/lib/modules/allotment";

// Two-level navigation: a department rail (one icon per accessible module) plus a
// secondary sidebar that shows the active module's workspace. Department managers
// are confined to the modules they own.

type Utility = { href: string; label: string; icon: IconName; resource: Resource };
const UTILITIES: Utility[] = [
  { href: "/group", label: "Group consolidation", icon: "chart", resource: "dashboards" },
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

  // Centre module allotment: confine the rail to the modules the user's
  // effective centre runs (admins and "All centres" views are unfiltered).
  const allottedSlugs = await allowedModuleSlugsFor(user);
  const modules: RailModule[] = accessibleModules(user, allottedSlugs).map((m) => ({
    slug: m.slug,
    name: m.name,
    icon: m.icon,
    group: m.group,
    match: m.match,
    links: m.links.filter((l) => effectiveCan(user, l.resource, "view")).map((l) => ({ label: l.label, href: l.href })),
  }));

  // Confined managers get no cross-module utility tools; others see what they can view.
  // Group/company consolidation is an org-level view — centre-pinned roles never see it.
  const utilities: UtilityItem[] = isModuleManager(user)
    ? []
    : UTILITIES
        .filter((u) => (u.href === "/group" ? !isBranchScoped(user.role) : true))
        .filter((u) => effectiveCan(user, u.resource, "view"))
        .map(({ href, label, icon }) => ({
          href: href === "/group" && isCompanyScoped(user.role) && user.companyId ? `/company/${user.companyId}` : href,
          label: href === "/group" && isCompanyScoped(user.role) ? "Company consolidation" : label,
          icon,
        }));

  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // Centre switcher data: company users see their company's centres; group
  // users see every centre grouped by company. Centre-pinned roles get none.
  let centreGroups: CentreGroup[] = [];
  if (!isBranchScoped(user.role)) {
    const branches = await prisma.branch.findMany({
      where: { active: true, ...(isCompanyScoped(user.role) && user.companyId ? { companyId: user.companyId } : {}) },
      orderBy: { name: "asc" },
      include: { company: true },
    });
    const byCompany = new Map<string, CentreGroup>();
    for (const b of branches) {
      const label = (b as { company?: { shortName?: string | null; name?: string } | null }).company?.shortName
        ?? (b as { company?: { name?: string } | null }).company?.name
        ?? "Group";
      const g = byCompany.get(label) ?? { company: label, centres: [] };
      g.centres.push({ id: b.id, name: b.name });
      byCompany.set(label, g);
    }
    centreGroups = [...byCompany.values()];
  }

  return (
    <AppShell
      modules={modules}
      utilities={utilities}
      user={{ name: user.name, role: user.role }}
      todayLabel={todayLabel}
      centreGroups={centreGroups}
      activeBranchId={user.activeBranchId}
    >
      {children}
    </AppShell>
  );
}
