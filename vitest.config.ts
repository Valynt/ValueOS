import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@shared": path.resolve(templateRoot, "packages", "shared", "src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/memory/tests/**/*.test.ts",
      "packages/memory/tests/**/*.spec.ts",
    ],
  },
});
