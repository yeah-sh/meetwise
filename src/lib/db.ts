// Shared Prisma client. Server-only: never import this from a client component.
// Next.js dev hot reload re-runs modules, which would open a new connection pool on
// every edit, so in development the client is cached on globalThis and reused.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local and restart the dev server.");
  }
  return new PrismaClient({
    // Prisma 7 connects through a driver adapter; this one uses node-postgres (pg).
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
