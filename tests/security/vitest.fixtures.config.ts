import path from "node:path";
import { defineConfig } from "vitest/config";

// Dedicated, local-only synthetic security fixtures.
// NEVER import tests/setup.ts: it reads .env.test and registers a service-role
// afterEach hook that deletes database rows matching a shared "test-%" prefix.
// These fixtures must not initialize a Supabase client or access external data.
const rootDir = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: rootDir,
  test: {
    name: "synthetic-security-fixtures",
    environment: "node",
    globals: false,
    include: ["tests/security/owasp-behavioral-security.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
