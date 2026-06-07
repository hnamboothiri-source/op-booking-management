import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { can, type Action, type Resource, type RoleName } from "@prm/core";

const COOKIE = "prm_uid";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  branchId: string | null;
}

/**
 * Dev-mode session: a cookie holds the chosen StaffUser id. This stands in for
 * Supabase Auth during Phase 0 so RBAC and branch scoping are demonstrable
 * locally without external auth. Replaced by real auth in a later phase.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const u = await prisma.staffUser.findUnique({ where: { id } });
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role as RoleName, branchId: u.branchId };
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

export async function setSession(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
