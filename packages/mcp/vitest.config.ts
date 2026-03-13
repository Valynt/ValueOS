import { defineConfig } from "vitest/config";
import path from "path";

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
