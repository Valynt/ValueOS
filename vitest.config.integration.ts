/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts", "./src/test/setup-integration.ts"],
    globalSetup: "./src/test/vitest-global-setup.ts",
    globalTeardown: "./src/test/vitest-global-teardown.ts",
    include: [
      "tests/integration/**/*.test.{ts,tsx}",
      "src/**/*.integration.test.{ts,tsx}",
      "src/**/__tests__/**/*.integration.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    testTimeout: 120000,
    hookTimeout: 180000,
    isolate: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});
