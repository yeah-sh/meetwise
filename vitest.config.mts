// Unit tests (npm test). They need neither Langflow nor PostgreSQL: tests that reach either one mock
// src/lib/langflow.ts and src/lib/db.ts.
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      // The same "@/..." imports as tsconfig.json's paths.
      "@": path.join(root, "src"),
      // "server-only" throws unless it is bundled for React Server Components, which tests are not.
      "server-only": path.join(root, "node_modules", "server-only", "empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Every test starts with fresh mocks (no calls, no leftover return values) and the real
    // environment variables and globals.
    mockReset: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
