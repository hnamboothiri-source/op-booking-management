/**
 * Module ownership = department managers (Module Workspaces).
 *
 * Mirrors branch scoping: a `module_manager` is appointed over one or more
 * modules (departments) and gets full CRUD on those modules' resources, on top
 * of their role grants. These helpers resolve the module→resource map from the
 * registry and combine it with the pure `effectiveCan` in @prm/core.
 *
 * `Principal` is the minimal shape we need (role + owned module slugs) so this
 * file doesn't depend on the session module (avoids an import cycle).
 */
import { can, effectiveCan as coreEffectiveCan, type Action, type Resource, type RoleName } from "@prm/core";
import { MODULE_DASHBOARDS, getModuleBySlug, type ModuleDef } from "./registry";

export interface Principal {
  role: RoleName;
  managedModules: string[];
}

/** Resources a module governs: its primary resource + every workspace-link resource. */
export function moduleResources(slug: string): Resource[] {
  const m = getModuleBySlug(slug);
  if (!m) return [];
  const set = new Set<Resource>([m.resource, ...m.links.map((l) => l.resource)]);
  return [...set];
}

/** Union of resources across all modules the user owns. */
export function managedResources(user: Principal): Resource[] {
  const set = new Set<Resource>();
  for (const slug of user.managedModules) for (const r of moduleResources(slug)) set.add(r);
  return [...set];
}

/** Is this user a department manager (owns at least one module)? */
export function isModuleManager(user: Principal): boolean {
  return user.role === "module_manager" || user.managedModules.length > 0;
}

/** Role permission OR ownership of a module that governs `resource`. */
export function effectiveCan(user: Principal, resource: Resource, action: Action): boolean {
  return coreEffectiveCan(can(user.role, resource, action), managedResources(user), resource);
}

/** Does the user own (manage) this module? */
export function ownsModule(user: Principal, slug: string): boolean {
  return user.managedModules.includes(slug);
}

/**
 * Who may CONFIGURE a module (define masters, cadence, plan entry/report fields):
 * the global administrator or the module's owning manager. Ordinary data-entry
 * users only consume the config.
 */
export function canConfigureModule(user: Principal, slug: string): boolean {
  return user.role === "administrator" || ownsModule(user, slug);
}

/**
 * Modules the user may enter. Confined managers see ONLY the modules they own;
 * everyone else sees the registry filtered by role view-permission.
 */
export function accessibleModules(user: Principal): ModuleDef[] {
  if (isModuleManager(user)) return MODULE_DASHBOARDS.filter((m) => user.managedModules.includes(m.slug));
  return MODULE_DASHBOARDS.filter((m) => can(user.role, m.resource, "view"));
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Which module owns this route (via its `/modules/<slug>` path or `match` prefixes). */
export function moduleForPath(pathname: string): ModuleDef | undefined {
  return MODULE_DASHBOARDS.find((m) =>
    [`/modules/${m.slug}`, ...m.match].some((p) => matchesPrefix(pathname, p)),
  );
}

/** A confined manager's default landing workspace (first owned module). */
export function defaultWorkspace(user: Principal): string {
  return user.managedModules.length ? `/modules/${user.managedModules[0]}` : "/";
}
