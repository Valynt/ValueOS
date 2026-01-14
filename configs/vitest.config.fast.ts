/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Fast Test Configuration
 * 
 * Minimal config for quick unit tests.
 * NO setup files, NO global setup, NO database.
 * 
 * Run with: npx vitest run --config vitest.config.fast.ts
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    // NO setupFiles
    // NO globalSetup
    include: [
      "src/config/__tests__/*.test.ts",
      "src/utils/__tests__/*.test.ts",
    ],
    exclude: [
      "node_modules",
      "dist",
      "**/*.integration.test.{ts,tsx}",
    ],
    testTimeout: 5000,
    isolate: true,
    retry: 0,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
  },
});
