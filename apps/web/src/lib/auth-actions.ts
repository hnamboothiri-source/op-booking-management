"use server";

import { redirect } from "next/navigation";
import { setSession, clearSession } from "./session";

/** Dev login: adopt a seeded StaffUser identity. */
export async function loginAs(userId: string): Promise<void> {
  await setSession(userId);
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
