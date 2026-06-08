import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Action, type Resource, type RoleName } from "@prm/core";
import { store } from "./mock/dataset";

const COOKIE = "prm_role";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  branchId: string | null;
}

/**
 * PROTOTYPE auth: a `prm_role` cookie holds the chosen role (set by the login
 * role-picker). The current user is synthesised from the mock staff list — no
 * database, no password. RBAC (`can`) is unchanged so role-based nav/guards
 * still demo correctly. Real auth returns in the backend phase.
 */
function mockUserForRole(role: RoleName): CurrentUser {
  const staff = (store.staffUser ?? []).find((s) => s.role === role);
  if (staff) return { id: staff.id, name: staff.name, email: staff.email, role, branchId: staff.branchId ?? null };
  const title = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { id: `mock-${role}`, name: title, email: `${role}@demo.test`, role, branchId: null };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const role = (await cookies()).get(COOKIE)?.value as RoleName | undefined;
  if (!role) return null;
  return mockUserForRole(role);
}

/** Require a logged-in user or redirect to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** Require a permission or redirect to a friendly forbidden page. */
export async function requireCan(resource: Resource, action: Action): Promise<CurrentUser> {
  const u = await requireUser();
  if (!can(u.role, resource, action)) redirect("/forbidden");
  return u;
}

/** Start a session for a chosen role (prototype). */
export async function setSession(role: string): Promise<void> {
  (await cookies()).set(COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
