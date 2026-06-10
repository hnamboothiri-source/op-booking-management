import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isBranchScoped, isCompanyScoped, type Resource } from "@prm/core";
import { prisma } from "@/lib/db";
import { AppShell, type CentreGroup, type ModuleTabBarData, type RailModule, type UtilityItem } from "@/components/shell/AppShell";
import { type IconName } from "@/components/shell/NavIcon";
import { accessibleModules, effectiveCan, isModuleManager, ownsModule, moduleForPath, defaultWorkspace } from "@/lib/modules/access";
import { allowedModuleSlugsFor } from "@/lib/modules/allotment";
import { pageAllowed } from "@prm/core";

// Navigation: a department rail + a secondary sidebar that ALWAYS lists the
// departments; a module's own pages render as a tab bar at the top of its
// pages. Tools access is admin-granted per designation (empty = role default).
import { UTILITIES } from "@/lib/tools";

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

  // Designation page access: when the user's designation limits a module to
  // specific pages, deep links to other pages bounce to that module's dashboard.
  if (user.designationPages && user.role !== "administrator" && pathname) {
    const mod = moduleForPath(pathname);
    if (mod && pathname !== `/modules/${mod.slug}` && !pageAllowed(user.designationPages, mod.slug, pathname)) {
      redirect(`/modules/${mod.slug}`);
    }
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
    links: m.links
      .filter((l) => effectiveCan(user, l.resource, "view"))
      .filter((l) => pageAllowed(user.designationPages, m.slug, l.href))
      .map((l) => ({ label: l.label, href: l.href })),
    allowedPages: user.designationPages?.[m.slug]?.length ? user.designationPages[m.slug] : null,
  }));

  // Tools: admins see all; an admin-granted designation list shows exactly those;
  // otherwise the role's own view grants decide (org tools stay hidden from
  // centre-pinned roles). Confined module managers get none.
  const utilities: UtilityItem[] = isModuleManager(user)
    ? []
    : UTILITIES
        .filter((u) => {
          if (user.role === "administrator") return true;
          if (user.designationTools) return user.designationTools.includes(u.key);
          if ((u.key === "group" || u.key === "master-plan") && isBranchScoped(user.role)) return false;
          return effectiveCan(user, u.resource, "view");
        })
        .map(({ href, label, icon }) => ({
          href: href === "/group" && isCompanyScoped(user.role) && user.companyId ? `/company/${user.companyId}` : href,
          label: href === "/group" && isCompanyScoped(user.role) ? "Company consolidation" : label,
          icon,
        }));

  // The active module's connection pages — rendered as a tab bar at the top of
  // every page belonging to the module (the sidebar only lists departments).
  let moduleTab: ModuleTabBarData | null = null;
  const currentModule = pathname ? moduleForPath(pathname) : undefined;
  const railModule = currentModule ? modules.find((m) => m.slug === currentModule.slug) : undefined;
  if (currentModule && railModule) {
    const slug = currentModule.slug;
    const pageOk = (href: string) =>
      href === `/modules/${slug}` || pageAllowed(user.designationPages, slug, href);
    moduleTab = {
      slug,
      name: currentModule.name,
      icon: currentModule.icon,
      items: [
        { label: "Dashboard", href: `/modules/${slug}` },
        { label: "Guide", href: `/modules/${slug}/guide` },
        { label: "Plan", href: `/modules/${slug}/plan` },
        ...railModule.links,
        { label: "Masters", href: `/modules/${slug}/masters` },
        { label: "Configure", href: `/modules/${slug}/configure` },
        { label: "Reports", href: `/modules/${slug}/reports` },
      ].filter((i) => pageOk(i.href)),
    };
  }

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
      moduleTab={moduleTab}
    >
      {children}
    </AppShell>
  );
}
