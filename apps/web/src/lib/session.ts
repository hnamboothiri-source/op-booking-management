import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type Action, type Resource, type RoleName, type PlanRank } from "@prm/core";
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

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  branchId: string | null;
  /** Module slugs this user manages (department-manager scope). */
  managedModules: string[];
  /** Maker-checker-approver tier. */
  planRank: PlanRank;
}

/**
 * PROTOTYPE auth: either a `prm_uid` cookie (a specific staff member — used for
 * department managers so their owned-module scope demos correctly) or a
 * `prm_role` cookie (the role-picker quick logins). The current user is
 * synthesised from the mock staff list — no database, no password. RBAC is
 * unchanged for roles; module managers gain CRUD on their owned modules via
 * `effectiveCan`. Real auth returns in the backend phase.
 */
function toUser(staff: Record<string, unknown>): CurrentUser {
  return {
    id: staff.id as string,
    name: staff.name as string,
    email: staff.email as string,
    role: staff.role as RoleName,
    branchId: (staff.branchId as string) ?? null,
    managedModules: (staff.managedModules as string[]) ?? [],
    planRank: (staff.planRank as PlanRank) ?? rankForRole(staff.role as RoleName),
  };
}

function mockUserForRole(role: RoleName): CurrentUser {
  const staff = (store.staffUser ?? []).find((s) => s.role === role);
  if (staff) return toUser(staff);
  const title = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { id: `mock-${role}`, name: title, email: `${role}@demo.test`, role, branchId: null, managedModules: [], planRank: rankForRole(role) };
}

function mockUserById(id: string): CurrentUser | null {
  const staff = (store.staffUser ?? []).find((s) => s.id === id);
  return staff ? toUser(staff) : null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const uid = jar.get(UID_COOKIE)?.value;
  if (uid) {
    const byId = mockUserById(uid);
    if (byId) return byId;
  }
  const role = jar.get(COOKIE)?.value as RoleName | undefined;
  if (!role) return null;
  return mockUserForRole(role);
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

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(UID_COOKIE);
}
