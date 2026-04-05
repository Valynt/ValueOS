import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    globals: true,
    environment: "node",
    include: ["ground-truth/**/*.{test,spec}.ts", "crm/**/*.{test,spec}.ts", "memory-write/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "crm/core/__tests__/ConnectionPool.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@mcp-common": path.resolve(import.meta.dirname, "common"),
      "@backend": path.resolve(import.meta.dirname, "../backend/src"),
    },
  },
});
