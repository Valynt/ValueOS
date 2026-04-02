import path from "path";

import { defineConfig } from "vitest/config";

const rootDir = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      "@backend": path.resolve(rootDir, "packages", "backend", "src"),
      "@shared": path.resolve(rootDir, "packages", "shared", "src"),
    },
  },
  test: {
    name: "tenant-isolation-rls",
    environment: "node",
    globals: true,
    include: [
      "tests/security/**/*.test.ts",
      "tests/security/**/*.spec.ts",
      "tests/compliance/security/**/*.test.ts",
      "tests/compliance/security/**/*.spec.ts",
    ],
  },
});
