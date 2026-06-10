"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ROLE_GRANTS, wouldCreateCycle, validReportsTo,
  type ActivityAccess, type DesignationNode, type ModuleRanks, type PageAccess, type PlanRank, type RoleName,
} from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { getModuleBySlug, getPlanActivityType } from "../modules/registry";
import { TOOL_OPTIONS } from "../tools";

const PLAN_RANKS = ["read_only", "staff", "supervisor", "manager"] as const;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

/**
 * Read the editor form into validated designation data. Checkbox conventions:
 * `modules` (multi) = module slugs; `page:<slug>:<href>` = page-level grants;
 * `act:<slug>:<key>` = plan activity-type grants (none ticked for a module =
 * all its pages / all its activity types).
 */
async function readDesignationForm(fd: FormData, id: string | null): Promise<Record<string, unknown>> {
  const name = str(fd, "name");
  if (!name) throw new Error("Designation name is required");
  const companyId = str(fd, "companyId"); // null = group-level
  const level = Math.max(1, parseInt(str(fd, "level") ?? "1", 10) || 1);

  const roleTemplate = str(fd, "roleTemplate") as RoleName | null;
  if (!roleTemplate || !(roleTemplate in ROLE_GRANTS)) throw new Error("A valid role template is required");
  const planRank = str(fd, "planRank") as PlanRank | null;
  if (!planRank || !PLAN_RANKS.includes(planRank)) throw new Error("A valid approval tier is required");

  const moduleSlugs = fd.getAll("modules").map((v) => v.toString()).filter((s) => getModuleBySlug(s));
  // Page-level grants: page:<slug>:<href> checkboxes → { [slug]: hrefs }.
  // Activity-type grants: act:<slug>:<key> checkboxes → { [slug]: keys }.
  const pageAccess: PageAccess = {};
  const activityTypes: ActivityAccess = {};
  const moduleRanks: ModuleRanks = {};
  for (const key of fd.keys()) {
    if (key.startsWith("page:")) {
      const [, slug, ...hrefParts] = key.split(":");
      const href = hrefParts.join(":");
      if (!getModuleBySlug(slug) || !href.startsWith("/")) continue;
      (pageAccess[slug] ??= []).push(href);
    } else if (key.startsWith("act:")) {
      const [, slug, typeKey] = key.split(":");
      if (!getPlanActivityType(slug, typeKey)) continue;
      (activityTypes[slug] ??= []).push(typeKey);
    } else if (key.startsWith("rank:")) {
      // Per-module approval override: "" = use the designation default.
      const slug = key.slice(5);
      const value = fd.get(key)?.toString() as PlanRank | "";
      if (!getModuleBySlug(slug) || !value || !PLAN_RANKS.includes(value as PlanRank)) continue;
      moduleRanks[slug] = value as PlanRank;
    }
  }
  // Tools access (admin-granted): tool:<key> checkboxes; none ticked = role default.
  const tools: string[] = [];
  for (const key of fd.keys()) {
    if (!key.startsWith("tool:")) continue;
    const toolKey = key.slice(5);
    if (TOOL_OPTIONS.some((t) => t.key === toolKey)) tools.push(toolKey);
  }

  // Uniqueness per company catalogue.
  const clash = await prisma.designation.findFirst({ where: { name, companyId } });
  if (clash && clash.id !== id) throw new Error(`"${name}" already exists in this catalogue`);

  // Hierarchy: parent/approver must exist, be group-level or same-company, and not create a cycle.
  const all = (await prisma.designation.findMany({})) as unknown as DesignationNode[];
  const self: Pick<DesignationNode, "companyId"> = { companyId };
  const resolveRef = (key: "reportsToDesignationId" | "approverDesignationId") => {
    const refId = str(fd, key);
    if (!refId) return null;
    if (refId === id) throw new Error("A designation cannot report to itself");
    const ref = all.find((d) => d.id === refId);
    if (!ref) throw new Error("Selected designation not found");
    if (!validReportsTo(self, ref)) throw new Error(`"${ref.name}" belongs to another company — pick a group-level or same-company designation`);
    return refId;
  };
  const reportsToDesignationId = resolveRef("reportsToDesignationId");
  const approverDesignationId = resolveRef("approverDesignationId");
  if (id && reportsToDesignationId && wouldCreateCycle(all, id, reportsToDesignationId)) {
    throw new Error("That reporting line would create a cycle — a designation cannot (indirectly) report to itself");
  }

  return {
    name, companyId, level, roleTemplate, planRank, moduleSlugs,
    pageAccess: Object.keys(pageAccess).length ? pageAccess : null,
    activityTypes: Object.keys(activityTypes).length ? activityTypes : null,
    moduleRanks: Object.keys(moduleRanks).length ? moduleRanks : null,
    tools,
    reportsToDesignationId, approverDesignationId,
    active: fd.get("active") != null,
  };
}

export async function createDesignation(fd: FormData): Promise<void> {
  const user = await requireCan("masters", "edit");
  const data = await readDesignationForm(fd, null);
  const created = await prisma.designation.create({ data: { ...data, active: true } as never });
  await writeAudit({ actorId: user.id, action: "designation.create", entity: "designation", entityId: created.id, after: data });
  revalidatePath("/designations");
  revalidatePath("/", "layout");
  redirect(`/designations?d=${created.id}`); // land on the new designation's editor
}

export async function updateDesignation(fd: FormData): Promise<void> {
  const user = await requireCan("masters", "edit");
  const id = str(fd, "id");
  if (!id) throw new Error("id is required");
  const before = await prisma.designation.findUnique({ where: { id } });
  if (!before) throw new Error("Designation not found");
  const data = await readDesignationForm(fd, id);
  await prisma.designation.update({ where: { id }, data: data as never });
  await writeAudit({ actorId: user.id, action: "designation.update", entity: "designation", entityId: id, before: { name: before.name }, after: data });
  revalidatePath("/designations");
  revalidatePath("/", "layout");
  redirect(`/designations?d=${id}`); // stay on the edited designation
}

/** Assign (or clear) a staff member's designation. */
export async function assignDesignation(fd: FormData): Promise<void> {
  const user = await requireCan("masters", "edit");
  const staffId = str(fd, "staffId");
  if (!staffId) throw new Error("staffId is required");
  const staff = await prisma.staffUser.findUnique({ where: { id: staffId } });
  if (!staff) throw new Error("Staff member not found");
  if (staff.role === "administrator") throw new Error("Administrators cannot be put under a designation");

  const designationId = str(fd, "designationId");
  if (designationId) {
    const des = await prisma.designation.findUnique({ where: { id: designationId } });
    if (!des) throw new Error("Designation not found");
    if (des.companyId && staff.companyId && des.companyId !== staff.companyId) {
      throw new Error("That designation belongs to another company");
    }
  }
  await prisma.staffUser.update({ where: { id: staffId }, data: { designationId: designationId ?? null } });
  await writeAudit({ actorId: user.id, action: "staff.designation", entity: "staff_user", entityId: staffId, before: { designationId: staff.designationId ?? null }, after: { designationId } });
  revalidatePath("/designations");
  revalidatePath("/", "layout");
}
