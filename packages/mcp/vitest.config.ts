import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["ground-truth/**/*.test.ts", "crm/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@mcp-common": path.resolve(import.meta.dirname, "common"),
    },
  },
});
