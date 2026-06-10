"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rupeesToPaise, shareOfTarget, type MasterPlanLine, type QuarterValues } from "@prm/core";
import { prisma } from "../db";
import { requireUser, type CurrentUser } from "../session";
import { writeAudit } from "../audit";
import { getModuleBySlug } from "../modules/registry";

/**
 * May this user edit the master plan of `companyId` (null = group)?
 * Group vision: administrators + group management. Company vision: also that
 * company's manager. Pure enough to reuse in the page for read-only rendering.
 */
export async function canEditMasterPlan(user: CurrentUser, companyId: string | null): Promise<boolean> {
  if (user.role === "administrator" || user.role === "management") return true;
  if (user.role === "company_manager") return companyId != null && companyId === user.companyId;
  return false;
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

/**
 * Save the budgetary vision: title, vision text and per-module allocation
 * lines. Inputs: `val:<slug>` yearly ₹; `q1:<slug>`…`q4:<slug>` quarter ₹
 * (all four set and non-zero-sum = explicit split, else even split);
 * `target:<slug>` count; `kpi:<slug>` KPI label.
 */
export async function saveMasterPlan(fd: FormData): Promise<void> {
  const user = await requireUser();
  const year = parseInt(str(fd, "year") ?? "", 10);
  if (!Number.isFinite(year)) throw new Error("Year is required");
  const companyId = str(fd, "companyId"); // null = group plan
  if (!(await canEditMasterPlan(user, companyId))) throw new Error("You may not edit this master plan");
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error("Company not found");
  }

  // Target-first: the yearly targeted figure, then allotments — ₹ wins; a bare
  // "% of target" converts via shareOfTarget.
  const targetValue = rupeesToPaise(str(fd, "targetValue"));

  const lines: MasterPlanLine[] = [];
  for (const key of fd.keys()) {
    if (!key.startsWith("val:")) continue;
    const slug = key.slice(4);
    if (!getModuleBySlug(slug)) continue;
    const rupeeValue = rupeesToPaise(str(fd, key));
    const pctRaw = str(fd, `pct:${slug}`);
    const pct = pctRaw ? parseFloat(pctRaw) : NaN;
    const yearlyValue = rupeeValue > 0
      ? rupeeValue
      : Number.isFinite(pct) && pct > 0 && targetValue > 0
        ? shareOfTarget(targetValue, pct)
        : 0;
    const qs = (["q1", "q2", "q3", "q4"] as const).map((q) => rupeesToPaise(str(fd, `${q}:${slug}`)));
    const quarters: QuarterValues | null = qs.some((v) => v > 0)
      ? { q1: qs[0], q2: qs[1], q3: qs[2], q4: qs[3] }
      : null;
    const targetRaw = str(fd, `target:${slug}`);
    const yearlyTarget = targetRaw ? parseInt(targetRaw, 10) || null : null;
    const kpiLabel = str(fd, `kpi:${slug}`);
    if (yearlyValue <= 0 && !quarters && !yearlyTarget) continue; // empty row — not part of the vision
    lines.push({ moduleSlug: slug, yearlyValue, yearlyTarget, kpiLabel, quarters });
  }

  const data = {
    title: str(fd, "title") ?? `Vision ${year}`,
    vision: str(fd, "vision"),
    targetValue,
    lines: lines as never,
    ownerId: user.id,
  };
  const existing = await prisma.masterPlan.findFirst({ where: { year, companyId } });
  const saved = existing
    ? await prisma.masterPlan.update({ where: { id: existing.id }, data })
    : await prisma.masterPlan.create({ data: { year, companyId, ...data } });

  await writeAudit({ actorId: user.id, action: "masterplan.save", entity: "master_plan", entityId: saved.id, after: { year, companyId, lines: lines.length } });
  revalidatePath("/master-plan");
  redirect(`/master-plan?scope=${companyId ?? "group"}&year=${year}`);
}
