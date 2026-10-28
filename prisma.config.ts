// Prisma CLI config (generate, migrate, studio, db seed).
// Prisma 7 does not load .env files by itself, and this app keeps secrets in .env.local,
// so we load the .env* files with @next/env, the same loader (and order) Next.js uses.
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Second argument = dev mode, so .env.development.local would also apply, like `next dev`.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not env("DATABASE_URL"): that throws when the variable is missing, which would break
    // `prisma generate` (and so `npm install`, via postinstall) before .env.local exists.
    // Commands that need the database still fail with a clear error without it.
    url: process.env.DATABASE_URL,
  },
});
