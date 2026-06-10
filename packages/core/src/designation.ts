/**
 * Designations & reporting hierarchy. A designation is an admin-configurable
 * job title ("Group Head", "CEO", "Manager – Call Center", …) that carries:
 *  - a roleTemplate (its RBAC base — reuses the tested ROLE_GRANTS),
 *  - a planRank (maker-checker-approver tier),
 *  - module access (moduleSlugs; empty = role default) and page-level access
 *    within modules (pageAccess; missing/empty per module = all pages),
 *  - a reporting officer (reportsToDesignationId) and an authorizer
 *    (approverDesignationId; null = same as reporting officer).
 *
 * Catalogues are per company (companyId; null = group-level designations that
 * sit above both companies). Pure & dependency-free for unit testing — the web
 * layer owns all lookups.
 */
import type { PlanRank } from "./planning";
import type { RoleName } from "./rbac";

export type PageAccess = Record<string, string[]>;
/** Plan activity types per module: { [moduleSlug]: activity keys }. Missing/[] = all types. */
export type ActivityAccess = Record<string, string[]>;
/** Per-module approval override: { [moduleSlug]: PlanRank }. Missing = designation default. */
export type ModuleRanks = Record<string, PlanRank>;

export interface DesignationNode {
  id: string;
  name: string;
  companyId: string | null; // null = group-level
  level: number; // 1 = top of the org
  roleTemplate: RoleName;
  planRank: PlanRank;
  moduleSlugs: string[];
  pageAccess?: PageAccess | null;
  activityTypes?: ActivityAccess | null;
  moduleRanks?: ModuleRanks | null;
  /** Tool keys (admin-granted). Empty = role default. */
  tools?: string[] | null;
  reportsToDesignationId: string | null;
  approverDesignationId: string | null;
  active: boolean;
}

const byId = (all: DesignationNode[], id: string | null | undefined) =>
  id ? all.find((d) => d.id === id) ?? null : null;

/** Would pointing `id`'s reportsTo at `newReportsToId` create a cycle (incl. self)? */
export function wouldCreateCycle(all: DesignationNode[], id: string, newReportsToId: string | null): boolean {
  let cur = newReportsToId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === id) return true;
    if (seen.has(cur)) return false; // pre-existing corrupt cycle elsewhere — not ours
    seen.add(cur);
    cur = byId(all, cur)?.reportsToDesignationId ?? null;
  }
  return false;
}

/** The chain of reporting officers upward from (excluding) `id`, nearest first. */
export function reportingChain(all: DesignationNode[], id: string): DesignationNode[] {
  const out: DesignationNode[] = [];
  const seen = new Set<string>([id]);
  let cur = byId(all, id)?.reportsToDesignationId ?? null;
  while (cur && !seen.has(cur)) {
    const node = byId(all, cur);
    if (!node) break;
    out.push(node);
    seen.add(cur);
    cur = node.reportsToDesignationId;
  }
  return out;
}

/** Designations whose reporting officer is `id` (active only). */
export function directReportsOf(all: DesignationNode[], id: string): DesignationNode[] {
  return all.filter((d) => d.active && d.reportsToDesignationId === id);
}

/** Who authorizes this designation's actions: explicit approver, else the reporting officer (skipping inactive). */
export function approverOf(all: DesignationNode[], id: string): DesignationNode | null {
  const d = byId(all, id);
  if (!d) return null;
  const approver = byId(all, d.approverDesignationId ?? d.reportsToDesignationId);
  return approver && approver.active ? approver : null;
}

export interface DesignationTreeNode {
  node: DesignationNode;
  children: DesignationTreeNode[];
}

/** Org tree: roots = no parent / inactive or missing parent; children sorted by level then name. */
export function designationTree(all: DesignationNode[]): DesignationTreeNode[] {
  const active = all.filter((d) => d.active);
  const sort = (xs: DesignationNode[]) => [...xs].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const build = (d: DesignationNode, seen: Set<string>): DesignationTreeNode => ({
    node: d,
    children: sort(active.filter((c) => c.reportsToDesignationId === d.id && !seen.has(c.id)))
      .map((c) => build(c, new Set([...seen, c.id]))),
  });
  const roots = active.filter((d) => {
    const parent = byId(active, d.reportsToDesignationId);
    return !parent; // no parent, inactive parent, or dangling reference
  });
  return sort(roots).map((d) => build(d, new Set([d.id])));
}

/** May `candidate` be the reporting officer / approver of `designation`? Same company or group-level. */
export function validReportsTo(designation: Pick<DesignationNode, "companyId">, candidate: Pick<DesignationNode, "companyId">): boolean {
  return candidate.companyId === null || candidate.companyId === designation.companyId;
}

export interface EffectiveIdentity {
  role: RoleName;
  planRank: PlanRank;
  /** null = no designation restriction (role default). */
  moduleSlugs: string[] | null;
  /** null = no page restriction. */
  pageAccess: PageAccess | null;
  /** null = no activity-type restriction. */
  activityTypes: ActivityAccess | null;
  /** Per-module approval overrides; null = the base planRank everywhere. */
  moduleRanks: ModuleRanks | null;
  /** Admin-granted tool keys; null = role default. */
  tools: string[] | null;
}

/**
 * The single session derivation rule: an active designation supplies role
 * (template), planRank and access lists; administrators are never demoted;
 * no/inactive designation passes the staff record through unchanged.
 */
export function effectiveIdentity(
  staffRole: RoleName,
  staffPlanRank: PlanRank,
  designation: DesignationNode | null | undefined,
): EffectiveIdentity {
  if (!designation || !designation.active || staffRole === "administrator") {
    return { role: staffRole, planRank: staffPlanRank, moduleSlugs: null, pageAccess: null, activityTypes: null, moduleRanks: null, tools: null };
  }
  const pageAccess = designation.pageAccess && Object.keys(designation.pageAccess).length ? designation.pageAccess : null;
  const activityTypes = designation.activityTypes && Object.keys(designation.activityTypes).length ? designation.activityTypes : null;
  const moduleRanks = designation.moduleRanks && Object.keys(designation.moduleRanks).length ? designation.moduleRanks : null;
  return {
    role: designation.roleTemplate,
    planRank: designation.planRank,
    moduleSlugs: designation.moduleSlugs.length ? designation.moduleSlugs : null,
    pageAccess,
    activityTypes,
    moduleRanks,
    tools: designation.tools && designation.tools.length ? designation.tools : null,
  };
}

/**
 * Page-level check within a module. Allowed when there is no page restriction,
 * the module has no page list (or an empty one), or the path matches a granted
 * href (exact or as a path prefix, so "/leads" covers "/leads/123").
 */
export function pageAllowed(pageAccess: PageAccess | null | undefined, moduleSlug: string, pathname: string): boolean {
  if (!pageAccess) return true;
  const pages = pageAccess[moduleSlug];
  if (!pages || pages.length === 0) return true;
  return pages.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Activity-type check within a module: may this designation perform plan
 * activity `typeKey`? Allowed when there is no restriction, the module has no
 * list (or an empty one), or the key is listed (exact match).
 */
export function activityTypeAllowed(activityTypes: ActivityAccess | null | undefined, moduleSlug: string, typeKey: string): boolean {
  if (!activityTypes) return true;
  const keys = activityTypes[moduleSlug];
  if (!keys || keys.length === 0) return true;
  return keys.includes(typeKey);
}

/**
 * The approval tier that applies in one module: the designation's per-module
 * override when set, else its base rank. "A manager can approve something,
 * but a manager can't edit everything."
 */
export function rankForModule(baseRank: PlanRank, moduleRanks: ModuleRanks | null | undefined, moduleSlug: string): PlanRank {
  return moduleRanks?.[moduleSlug] ?? baseRank;
}
