// Data seam. PROTOTYPE: defaults to an in-memory mock so the app runs with no
// database. Set USE_REAL_DB=1 to use the real Prisma client (the later backend
// phase). The mock is typed as PrismaClient so all existing call sites compile.
import type { PrismaClient } from "@prm/db";
import { createMockPrisma } from "./mock/client";

function resolvePrisma(): PrismaClient {
  if (process.env.USE_REAL_DB) {
    // Lazy require so the prototype never needs a DB connection / env vars.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("@prm/db") as { prisma: PrismaClient }).prisma;
  }
  return createMockPrisma() as unknown as PrismaClient;
}

export const prisma: PrismaClient = resolvePrisma();
export type { Prisma } from "@prm/db";
