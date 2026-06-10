import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isBranchScoped, isCompanyScoped, effectiveIdentity, approverOf, type Action, type Resource, type RoleName, type PlanRank, type DesignationNode, type PageAccess, type ActivityAccess, type ModuleRanks } from "@prm/core";
import { store } from "./mock/dataset";
import { effectiveCan } from "./modules/access";

/** Default planning rank from a role when a staff record doesn't set one. */
function rankForRole(role: RoleName): PlanRank {
  if (role === "administrator" || role === "management" || role === "module_manager") return "manager";
  if (role === "branch_manager" || role === "call_center_manager") return "supervisor";
  return "staff";
}

const COOKIE = "prm_role";
const UID_COOKIE = "prm_uid";
const BRANCH_COOKIE = "prm_branch";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  branchId: string | null;
  /** Home company (company_manager scope; derived from branch for centre staff). */
  companyId: string | null;
  /** Centre selected in the switcher (company/group users); centre-pinned roles always get their own. */
  activeBranchId: string | null;
  /** Module slugs this user manages (department-manager scope). */
  managedModules: string[];
  /** Maker-checker-approver tier. */
  planRank: PlanRank;
  /** Job title (designation) the session derives from, when assigned. */
  designation: { id: string; name: string; level: number; approverName: string | null } | null;
  /** Designation's module access (null = role default). */
  designationModules: string[] | null;
  /** Designation's page-level access within modules (null = unrestricted). */
  designationPages: PageAccess | null;
  /** Plan activity types the designation may perform per module (null = unrestricted). */
  designationActivities: ActivityAccess | null;
  /** Per-module approval overrides (null = planRank applies everywhere). */
  designationModuleRanks: ModuleRanks | null;
  /** Admin-granted tool keys (null = role default). */
  designationTools: string[] | null;
}

/**
 * PROTOTYPE auth: either a `prm_uid` cookie (a specific staff member — used for
 * department managers so their owned-module scope demos correctly) or a
 * `prm_role` cookie (the role-picker quick logins). The current user is
 * synthesised from the mock staff list — no database, no password. RBAC is
 * unchanged for roles; module managers gain CRUD on their owned modules via
 * `effectiveCan`. Real auth returns in the backend phase.
 */
function companyOfBranch(branchId: string | null): string | null {
  if (!branchId) return null;
  const branch = (store.branch ?? []).find((b) => b.id === branchId);
  return (branch?.companyId as string) ?? null;
}

function toUser(staff: Record<string, unknown>): CurrentUser {
  const branchId = (staff.branchId as string) ?? null;
  // Designation-driven identity: an active designation supplies the RBAC role
  // template, approval rank and module/page access (administrators excepted).
  const all = (store.designation ?? []) as unknown as DesignationNode[];
  const designation = staff.designationId ? all.find((d) => d.id === staff.designationId) ?? null : null;
  const identity = effectiveIdentity(
    staff.role as RoleName,
    (staff.planRank as PlanRank) ?? rankForRole(staff.role as RoleName),
    designation,
  );
  const applied = designation && designation.active && (staff.role as RoleName) !== "administrator" ? designation : null;
  return {
    id: staff.id as string,
    name: staff.name as string,
    email: staff.email as string,
    role: identity.role,
    branchId,
    companyId: (staff.companyId as string) ?? companyOfBranch(branchId),
    activeBranchId: branchId,
    managedModules: (staff.managedModules as string[]) ?? [],
    planRank: identity.planRank,
    designation: applied
      ? { id: applied.id, name: applied.name, level: applied.level, approverName: approverOf(all, applied.id)?.name ?? null }
      : null,
    designationModules: identity.moduleSlugs,
    designationPages: identity.pageAccess,
    designationActivities: identity.activityTypes,
    designationModuleRanks: identity.moduleRanks,
    designationTools: identity.tools,
  };
}

function mockUserForRole(role: RoleName): CurrentUser {
  const staff = (store.staffUser ?? []).find((s) => s.role === role);
  if (staff) return toUser(staff);
  const title = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { id: `mock-${role}`, name: title, email: `${role}@demo.test`, role, branchId: null, companyId: null, activeBranchId: null, managedModules: [], planRank: rankForRole(role), designation: null, designationModules: null, designationPages: null, designationActivities: null, designationModuleRanks: null, designationTools: null };
}

function mockUserById(id: string): CurrentUser | null {
  const staff = (store.staffUser ?? []).find((s) => s.id === id);
  return staff ? toUser(staff) : null;
}

/**
 * Apply the centre-switcher cookie. Centre-pinned roles always keep their own
 * branch; company users may only pick a centre of their company; group users
 * may pick any centre (or none = all centres).
 */
function withActiveBranch(user: CurrentUser, picked: string | null | undefined): CurrentUser {
  if (isBranchScoped(user.role)) return user; // pinned — switcher never applies
  if (!picked) return { ...user, activeBranchId: null };
  const branch = (store.branch ?? []).find((b) => b.id === picked && b.active !== false);
  if (!branch) return { ...user, activeBranchId: null };
  if (isCompanyScoped(user.role) && branch.companyId !== user.companyId) return { ...user, activeBranchId: null };
  return { ...user, activeBranchId: picked };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const picked = jar.get(BRANCH_COOKIE)?.value || null;
  const uid = jar.get(UID_COOKIE)?.value;
  if (uid) {
    const byId = mockUserById(uid);
    if (byId) return withActiveBranch(byId, picked);
  }
  const role = jar.get(COOKIE)?.value as RoleName | undefined;
  if (!role) return null;
  return withActiveBranch(mockUserForRole(role), picked);
}

/** Require a logged-in user or redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** Require a permission (role grant OR owned-module scope) or redirect to forbidden. */
export async function requireCan(resource: Resource, action: Action): Promise<CurrentUser> {
  const u = await requireUser();
  if (!effectiveCan(u, resource, action)) redirect("/forbidden");
  return u;
}

/** Start a session for a chosen role (prototype role-picker). */
export async function setSession(role: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.delete(UID_COOKIE);
}

/** Start a session as a specific staff member (used for department managers). */
export async function setSessionUser(staffId: string): Promise<void> {
  const jar = await cookies();
  jar.set(UID_COOKIE, staffId, { httpOnly: true, sameSite: "lax", path: "/" });
  jar.delete(COOKIE);
}

/** Persist the centre-switcher selection (empty = all centres in scope). */
export async function setActiveBranchCookie(branchId: string | null): Promise<void> {
  const jar = await cookies();
  if (branchId) jar.set(BRANCH_COOKIE, branchId, { httpOnly: true, sameSite: "lax", path: "/" });
  else jar.delete(BRANCH_COOKIE);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(UID_COOKIE);
  jar.delete(BRANCH_COOKIE);
}
