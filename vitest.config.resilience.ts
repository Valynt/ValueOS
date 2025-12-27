/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // No global setup, only basic setup if needed
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/services/__tests__/AgentQueryService.test.ts",
      "src/lib/resilience/__tests__/*.test.ts",
    ],
    // Disable multi-threading issues for simple unit tests if needed, but 'forks' is fine
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
});
