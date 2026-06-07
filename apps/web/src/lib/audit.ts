import { prisma } from "./db";

/**
 * Append an audit record (Module 16 security requirement). Best-effort: audit
 * failures must never block the primary mutation, so errors are swallowed after
 * logging to the server console.
 */
export async function writeAudit(params: {
  actorId?: string | null;
  action: string; // e.g. "branch.create", "task.transition"
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        before: (params.before as object) ?? undefined,
        after: (params.after as object) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write", params.action, err);
  }
}
