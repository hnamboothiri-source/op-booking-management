"use server";

import { redirect } from "next/navigation";
import { store } from "./mock/dataset";
import { setSession, clearSession } from "./session";

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

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
