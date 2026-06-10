"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { getMaster } from "./registry";
import { buildData } from "./coerce";

// Prisma delegate accessor (dynamic by model name from the registry).
function delegate(model: string): {
  findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
  delete: (args: unknown) => Promise<Record<string, unknown>>;
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model];
}

export async function listRows(key: string): Promise<Record<string, unknown>[]> {
  await requireCan("masters", "view");
  const m = getMaster(key);
  if (!m || m.managedInModule) return [];
  const orderBy = { [m.listColumns[0] ?? "id"]: "asc" as const };
  return delegate(m.model).findMany({ orderBy });
}

export async function getRow(key: string, id: string): Promise<Record<string, unknown> | null> {
  await requireCan("masters", "view");
  const m = getMaster(key);
  if (!m) return null;
  return delegate(m.model).findUnique({ where: { id } });
}

/** Options for a foreign-key `ref` field. */
export async function refOptions(ref: "branch" | "department" | "marketingChannel" | "company"): Promise<{ value: string; label: string }[]> {
  const model = ref === "marketingChannel" ? "marketingChannelMaster" : ref;
  const rows = await delegate(model).findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return rows.map((r) => ({ value: String(r.id), label: String((r as { shortName?: string | null }).shortName ?? r.name) }));
}

export async function createRow(key: string, fd: FormData): Promise<void> {
  const user = await requireCan("masters", "create");
  const m = getMaster(key);
  if (!m) throw new Error(`Unknown master: ${key}`);
  const data = buildData(m.fields, fd);
  const created = await delegate(m.model).create({ data });
  await writeAudit({ actorId: user.id, action: `${key}.create`, entity: m.model, entityId: String(created.id), after: data });
  revalidatePath(`/masters/${key}`);
  redirect(`/masters/${key}`);
}

export async function updateRow(key: string, id: string, fd: FormData): Promise<void> {
  const user = await requireCan("masters", "edit");
  const m = getMaster(key);
  if (!m) throw new Error(`Unknown master: ${key}`);
  const before = await delegate(m.model).findUnique({ where: { id } });
  const data = buildData(m.fields, fd);
  await delegate(m.model).update({ where: { id }, data });
  await writeAudit({ actorId: user.id, action: `${key}.update`, entity: m.model, entityId: id, before, after: data });
  revalidatePath(`/masters/${key}`);
  redirect(`/masters/${key}`);
}

export async function deleteRow(key: string, id: string): Promise<void> {
  const user = await requireCan("masters", "delete");
  const m = getMaster(key);
  if (!m) throw new Error(`Unknown master: ${key}`);
  const before = await delegate(m.model).findUnique({ where: { id } });
  await delegate(m.model).delete({ where: { id } });
  await writeAudit({ actorId: user.id, action: `${key}.delete`, entity: m.model, entityId: id, before });
  revalidatePath(`/masters/${key}`);
}
