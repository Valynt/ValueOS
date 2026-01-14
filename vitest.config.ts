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
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts", "./src/test/setup-unit.ts", "./src/sdui/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      ".storybook",
      "storybook-static",
      "test/performance/**",
      "src/sdui/__tests__/security.pure-unit.test.ts",
      "**/*.int.test.ts",
      "**/*.integration.test.ts",
      "**/integration/**/*.{test,spec}.{ts,tsx}",
    ],
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
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 65,
        statements: 75,
      },
    },
    testTimeout: 15000,
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
