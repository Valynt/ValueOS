import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@valueos/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts"),
      "@valueos/shared/*": path.resolve(import.meta.dirname, "../shared/src/*"),
    },
  },
});
