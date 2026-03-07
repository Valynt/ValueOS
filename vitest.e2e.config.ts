import path from "path";
import { fileURLToPath } from "url";

import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 10000,
    pool: "forks",
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./packages/shared/src"),
      "@backend": path.resolve(__dirname, "./packages/backend/src"),
      "@infra": path.resolve(__dirname, "./packages/infra"),
      "@memory": path.resolve(__dirname, "./packages/memory"),
      "@agents": path.resolve(__dirname, "./packages/agents"),
      "@integrations": path.resolve(__dirname, "./packages/integrations"),
      "@mcp": path.resolve(__dirname, "./packages/mcp"),
      "@mcp-common": path.resolve(__dirname, "./packages/mcp/common"),
      "@sdui": path.resolve(__dirname, "./packages/sdui/src"),
    },
  },
});
