/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom", // DOM environment for React component testing
    setupFiles: [
      "./tests/integration/vitest.setup.ts",
      "./tests/setup.ts",
      "./src/test/setup.ts",
      "./src/test/setup-integration.ts",
      "./src/sdui/__tests__/setup.ts",
    ],
    globalSetup: "./src/test/vitest-global-setup.ts", // Use testcontainers
    include: [
      "**/*.integration.test.{ts,tsx}",
      "src/repositories/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".storybook", "storybook-static"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "test/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "dist/",
        ".storybook/",
        "storybook-static/",
      ],
    },
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 60000,
    isolate: true,
    retry: process.env.CI ? 2 : 0,
    bail: process.env.CI ? 1 : 0,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@security": path.resolve(__dirname, "./src/security"),
    },
  },
});
