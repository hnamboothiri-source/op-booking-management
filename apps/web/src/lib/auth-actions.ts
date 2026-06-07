"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { setSession, clearSession } from "./session";

/** Verify email + password and start a session. */
export async function loginWithPassword(fd: FormData): Promise<void> {
  const email = fd.get("email")?.toString().trim().toLowerCase();
  const password = fd.get("password")?.toString() ?? "";
  if (!email || !password) redirect("/login?error=1");

  const user = await prisma.staffUser.findUnique({ where: { email } });
  const ok = !!user && user.active && !!user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!ok || !user) redirect("/login?error=1");

  await setSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
