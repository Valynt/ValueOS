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
    environment: "node", // Use node env for backend/repo tests
    setupFiles: [
      "./tests/setup.ts",
      "./src/test/setup-integration.ts",
      "./src/sdui/__tests__/setup.ts",
    ],
    globalSetup: "./src/test/vitest-global-setup.ts",
    globalTeardown: "./src/test/vitest-global-teardown.ts",
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      all: true,
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
    exclude: [
      "node_modules",
      "dist",
      ".storybook",
      "storybook-static",
      "test/performance/**",
      "src/sdui/__tests__/security.pure-unit.test.ts", // Standalone test, not for Vitest
    ],
    // ⚠️ Important: Run sequentially to avoid race conditions on the single container
    // Enable parallel execution with pooling
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 4,
        minForks: 1,
      },
    },
    // Reduce timeouts for faster feedback
    testTimeout: 15000,
    hookTimeout: 60000,
    // Isolate tests to prevent cross-contamination
    isolate: true,
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
