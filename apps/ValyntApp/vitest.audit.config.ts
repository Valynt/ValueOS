/**
 * Audit test runner configuration.
 *
 * Must be invoked from apps/ValyntApp/ using the repo-root vitest binary
 * so the include glob resolves relative to this package and the root
 * workspace projects are not loaded alongside it:
 *
 *   cd apps/ValyntApp && PATH="../../node_modules/.bin:$PATH" vitest run --config vitest.audit.config.ts
 *
 * Passing/failing semantics:
 *   PASS  = confirmed strength (observed fact matches criterion)
 *   FAIL  = documented finding (gap that needs to be addressed)
 */

import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/audit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
