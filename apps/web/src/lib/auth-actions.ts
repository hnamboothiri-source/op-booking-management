"use server";

import { redirect } from "next/navigation";
import { store } from "./mock/dataset";
import { setSession, setSessionUser, clearSession } from "./session";

/**
 * PROTOTYPE login: no password. The login role-picker posts a `role`; an email
 * (if given) is mapped to its mock staff role. Either way we just set the role
 * cookie and enter the app.
 */
export async function loginWithPassword(fd: FormData): Promise<void> {
  let role = fd.get("role")?.toString().trim();
  if (!role) {
    const email = fd.get("email")?.toString().trim().toLowerCase();
    const staff = (store.staffUser ?? []).find((s) => s.email === email);
    role = staff?.role ?? "administrator";
  }
  await setSession(role ?? "administrator");
  redirect("/");
}

/** PROTOTYPE login as a specific staff member (used for department managers so
 * their owned-module scope demos correctly). */
export async function loginAsStaff(fd: FormData): Promise<void> {
  const staffId = fd.get("staffId")?.toString().trim();
  const staff = staffId ? (store.staffUser ?? []).find((s) => s.id === staffId) : null;
  if (!staff) {
    await setSession("administrator");
    redirect("/");
  }
  await setSessionUser(staff!.id);
  // Managers land in their first owned department; others at the consolidation home.
  const slugs = (staff!.managedModules as string[]) ?? [];
  redirect(slugs.length ? `/modules/${slugs[0]}` : "/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
