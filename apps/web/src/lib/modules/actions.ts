"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { getModuleBySlug } from "./registry";

/**
 * Appoint a staff member as department manager of a set of modules. Admin-only.
 * Mutates the staff record's `managedModules`; the role is normalised to
 * `module_manager` when they own any module. Prototype: writes to the mock store.
 */
export async function setManagedModules(fd: FormData): Promise<void> {
  const user = await requireCan("masters", "edit");
  const staffId = fd.get("staffId")?.toString();
  if (!staffId) throw new Error("staffId is required");

  const slugs = fd.getAll("modules").map((v) => v.toString()).filter((s) => getModuleBySlug(s));

  const staff = await prisma.staffUser.findUnique({ where: { id: staffId } });
  if (!staff) throw new Error("Staff member not found");
  // Never confine an administrator — that would lock them out of cross-module admin.
  if (staff.role === "administrator") throw new Error("Administrators cannot be confined to modules");

  // Don't demote a real role (admin/doctor/etc.) — only flip dedicated managers.
  const before = { managedModules: staff.managedModules ?? [], role: staff.role };
  const nextRole = slugs.length > 0 ? "module_manager" : staff.role === "module_manager" ? "module_manager" : staff.role;

  await prisma.staffUser.update({
    where: { id: staffId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { managedModules: slugs as any, role: nextRole as any },
  });
  await writeAudit({ actorId: user.id, action: "staff.manage_modules", entity: "staff_user", entityId: staffId, before, after: { managedModules: slugs, role: nextRole } });
  revalidatePath("/module-access/managers");
  revalidatePath("/module-access");
}
