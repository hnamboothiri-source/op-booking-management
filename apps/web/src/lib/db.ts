// Data seam. PROTOTYPE: defaults to an in-memory mock so the app runs with no
// database. Set USE_REAL_DB=1 to use the real Prisma client (the later backend
// phase). The mock is typed as PrismaClient so all existing call sites compile.
// With CORE_SYNC=1 the mock's MASTER data is hydrated from the group's central
// Supabase `core` schema (see core-sync.ts) before any query resolves.
import type { PrismaClient } from "@prm/db";
import { createMockPrisma } from "./mock/client";
import { ensureCoreSync } from "./core-sync";

// Every mock delegate method is async, so awaiting the (cached) central-masters
// sync in front of it is invisible to all call sites.
function withCoreSync(client: any): any {
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop];
      if (typeof prop !== "string" || prop.startsWith("$")) return value;
      if (typeof value !== "object" || value === null) return value;
      return new Proxy(value, {
        get(delegate, method) {
          const fn = delegate[method];
          if (typeof fn !== "function") return fn;
          return (...args: unknown[]) => ensureCoreSync().then(() => fn.apply(delegate, args));
        },
      });
    },
  });
}

function resolvePrisma(): PrismaClient {
  if (process.env.USE_REAL_DB) {
    // Lazy require so the prototype never needs a DB connection / env vars.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("@prm/db") as { prisma: PrismaClient }).prisma;
  }
  const mock = createMockPrisma();
  return (process.env.CORE_SYNC ? withCoreSync(mock) : mock) as unknown as PrismaClient;
}

export const prisma: PrismaClient = resolvePrisma();
export type { Prisma } from "@prm/db";
