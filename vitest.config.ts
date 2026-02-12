import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "apps/**/*.{test,spec}.{js,ts,jsx,tsx}",
      "packages/**/*.{test,spec}.{js,ts,jsx,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.archive/**",
      "**/archive/**",
      "**/*.integration.test.*",
      "**/*.integration.spec.*",
      "**/load.test.*",
      "**/*.load.test.*",
      "**/*.perf.test.*",
      "**/*.e2e.test.*",
      "**/*.e2e.spec.*",
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    pool: "forks",
    fileParallelism: true,
    maxConcurrency: 20,
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["node_modules/", "src/test/", "**/*.config.*"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/ValyntApp/src"),
      "@app": path.resolve(__dirname, "./apps/ValyntApp/src/app"),
      "@pages": path.resolve(__dirname, "./apps/ValyntApp/src/pages"),
      "@layouts": path.resolve(__dirname, "./apps/ValyntApp/src/layouts"),
      "@components": path.resolve(__dirname, "./apps/ValyntApp/src/components"),
      "@features": path.resolve(__dirname, "./apps/ValyntApp/src/features"),
      "@services": path.resolve(__dirname, "./apps/ValyntApp/src/services"),
      "@lib": path.resolve(__dirname, "./apps/ValyntApp/src/lib"),
      "@hooks": path.resolve(__dirname, "./apps/ValyntApp/src/hooks"),
      "@types": path.resolve(__dirname, "./apps/ValyntApp/src/types"),
      "@shared": path.resolve(__dirname, "./packages/shared/src"),
      "@backend": path.resolve(__dirname, "./packages/backend/src"),
      "@infra": path.resolve(__dirname, "./packages/infra"),
      "@memory": path.resolve(__dirname, "./packages/memory"),
      "@agents": path.resolve(__dirname, "./packages/agents"),
      "@integrations": path.resolve(__dirname, "./packages/integrations"),
      "@mcp": path.resolve(__dirname, "./packages/mcp"),
      "@mcp-common": path.resolve(__dirname, "./packages/mcp/common"),
      "@sdui": path.resolve(__dirname, "./packages/sdui/src"),
      "@valueos/design-system": path.resolve(__dirname, "./packages/components/design-system/src"),
    },
  },
});
