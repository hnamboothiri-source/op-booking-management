"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireUser, type CurrentUser } from "../session";
import { canConfigureModule, moduleResources } from "../modules/access";
import { effectiveCan } from "../modules/access";
import { writeAudit } from "../audit";
import { buildData } from "../masters/coerce";
import { buildFieldDef } from "./actions";
import { getModuleBySlug } from "../modules/registry";
import type { FieldDef } from "../masters/registry";
import type { Resource } from "@prm/core";

export interface ModuleMasterRow {
  id: string;
  moduleSlug: string;
  key: string;
  label: string;
  fields: FieldDef[];
  listColumns: string[];
  active: boolean;
}

const asFields = (v: unknown): FieldDef[] => (Array.isArray(v) ? (v as FieldDef[]) : []);
const asCols = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

function moduleResource(slug: string): Resource {
  const def = getModuleBySlug(slug);
  return (def?.resource ?? moduleResources(slug)[0] ?? "dashboards") as Resource;
}

async function requireConfigure(slug: string): Promise<CurrentUser> {
  const u = await requireUser();
  if (!canConfigureModule(u, slug)) redirect("/forbidden");
  return u;
}

async function requireView(slug: string): Promise<CurrentUser> {
  const u = await requireUser();
  if (!effectiveCan(u, moduleResource(slug), "view")) redirect("/forbidden");
  return u;
}

// ---------------------------------------------------------------- module masters
export async function listModuleMasters(slug: string): Promise<ModuleMasterRow[]> {
  await requireView(slug);
  const rows = await prisma.moduleMaster.findMany({ where: { moduleSlug: slug }, orderBy: { label: "asc" } });
  return rows.map((r) => ({
    id: r.id as string, moduleSlug: r.moduleSlug as string, key: r.key as string, label: r.label as string,
    fields: asFields(r.fields), listColumns: asCols(r.listColumns), active: Boolean(r.active),
  }));
}

export async function getModuleMaster(slug: string, key: string): Promise<ModuleMasterRow | null> {
  await requireView(slug);
  const r = await prisma.moduleMaster.findFirst({ where: { moduleSlug: slug, key } });
  if (!r) return null;
  return {
    id: r.id as string, moduleSlug: r.moduleSlug as string, key: r.key as string, label: r.label as string,
    fields: asFields(r.fields), listColumns: asCols(r.listColumns), active: Boolean(r.active),
  };
}

/** Turn any text into a safe master key: lowercase, hyphenated, letter-first. */
function slugifyKey(s: string): string {
  const base = s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")  // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "")       // trim hyphens
    .replace(/-{2,}/g, "-");        // collapse
  if (!base) return "";
  return /^[a-z]/.test(base) ? base : `m-${base}`;
}

export async function createModuleMaster(slug: string, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const label = fd.get("label")?.toString().trim();
  if (!label) throw new Error("Label is required.");
  // Derive a safe key from the provided key OR the label — never reject the input.
  const rawKey = fd.get("key")?.toString().trim();
  let key = slugifyKey(rawKey || "") || slugifyKey(label) || "master";
  // Ensure uniqueness within the module by appending -2, -3, …
  const taken = new Set((await prisma.moduleMaster.findMany({ where: { moduleSlug: slug } })).map((m) => m.key as string));
  if (taken.has(key)) { let n = 2; while (taken.has(`${key}-${n}`)) n++; key = `${key}-${n}`; }
  const created = await prisma.moduleMaster.create({ data: { moduleSlug: slug, key, label, fields: [], listColumns: [], active: true } });
  await writeAudit({ actorId: user.id, action: "moduleMaster.create", entity: "module_master", entityId: created.id as string, after: { slug, key, label } });
  revalidatePath(`/modules/${slug}/masters`);
  redirect(`/modules/${slug}/masters/${key}/edit`);
}

export async function deleteModuleMaster(slug: string, masterId: string): Promise<void> {
  const user = await requireConfigure(slug);
  await prisma.moduleMaster.delete({ where: { id: masterId } });
  await writeAudit({ actorId: user.id, action: "moduleMaster.delete", entity: "module_master", entityId: masterId });
  revalidatePath(`/modules/${slug}/masters`);
}

export async function addMasterField(slug: string, masterId: string, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const field = await buildFieldDef(fd);
  if (!field) return;
  const m = await prisma.moduleMaster.findUnique({ where: { id: masterId } });
  if (!m) return;
  const fields = asFields(m.fields);
  if (fields.some((f) => f.name === field.name)) return;
  fields.push(field);
  const listColumns = [...new Set([...asCols(m.listColumns), field.name])];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.moduleMaster.update({ where: { id: masterId }, data: { fields, listColumns } as any });
  await writeAudit({ actorId: user.id, action: "moduleMaster.field.add", entity: "module_master", entityId: masterId, after: { field: field.name } });
  revalidatePath(`/modules/${slug}/masters/${m.key}/edit`);
}

export async function removeMasterField(slug: string, masterId: string, index: number): Promise<void> {
  const user = await requireConfigure(slug);
  const m = await prisma.moduleMaster.findUnique({ where: { id: masterId } });
  if (!m) return;
  const fields = asFields(m.fields);
  if (index < 0 || index >= fields.length) return;
  const [removed] = fields.splice(index, 1);
  const listColumns = asCols(m.listColumns).filter((c) => c !== removed.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.moduleMaster.update({ where: { id: masterId }, data: { fields, listColumns } as any });
  await writeAudit({ actorId: user.id, action: "moduleMaster.field.remove", entity: "module_master", entityId: masterId, after: { field: removed.name } });
  revalidatePath(`/modules/${slug}/masters/${m.key}/edit`);
}

// ---------------------------------------------------------------- custom records
export async function listCustomRecords(slug: string, masterKey: string): Promise<Record<string, unknown>[]> {
  await requireView(slug);
  const rows = await prisma.customRecord.findMany({ where: { moduleSlug: slug, masterKey } });
  return rows.map((r) => ({ id: r.id, ...(r.data as Record<string, unknown>) }));
}

export async function getCustomRecord(id: string): Promise<Record<string, unknown> | null> {
  const r = await prisma.customRecord.findUnique({ where: { id } });
  return r ? (r.data as Record<string, unknown>) : null;
}

export async function createCustomRecord(slug: string, masterKey: string, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const m = await prisma.moduleMaster.findFirst({ where: { moduleSlug: slug, key: masterKey } });
  if (!m) throw new Error("Master not found.");
  const data = buildData(asFields(m.fields), fd);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await prisma.customRecord.create({ data: { moduleSlug: slug, masterKey, data } as any });
  await writeAudit({ actorId: user.id, action: "customRecord.create", entity: "custom_record", entityId: created.id as string, after: { slug, masterKey } });
  revalidatePath(`/modules/${slug}/masters/${masterKey}`);
  redirect(`/modules/${slug}/masters/${masterKey}`);
}

export async function updateCustomRecord(slug: string, masterKey: string, id: string, fd: FormData): Promise<void> {
  const user = await requireConfigure(slug);
  const m = await prisma.moduleMaster.findFirst({ where: { moduleSlug: slug, key: masterKey } });
  if (!m) throw new Error("Master not found.");
  const data = buildData(asFields(m.fields), fd);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.customRecord.update({ where: { id }, data: { data } as any });
  await writeAudit({ actorId: user.id, action: "customRecord.update", entity: "custom_record", entityId: id, after: { slug, masterKey } });
  revalidatePath(`/modules/${slug}/masters/${masterKey}`);
  redirect(`/modules/${slug}/masters/${masterKey}`);
}

export async function deleteCustomRecord(slug: string, masterKey: string, id: string): Promise<void> {
  const user = await requireConfigure(slug);
  await prisma.customRecord.delete({ where: { id } });
  await writeAudit({ actorId: user.id, action: "customRecord.delete", entity: "custom_record", entityId: id });
  revalidatePath(`/modules/${slug}/masters/${masterKey}`);
}
