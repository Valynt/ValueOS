/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import baseConfig from "./vitest.config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...baseConfig,
  plugins: [react()],
  test: {
    ...baseConfig.test,
    globals: true,
    environment: "happy-dom",
    // EXCLUDE integration setup to avoid Docker dependency
    setupFiles: ["./tests/setup.ts", "./src/test/setup.ts", "./src/sdui/__tests__/setup.ts"],
    // Only include UI tests
    include: ["src/views/**/*.{test,spec}.{ts,tsx}"],
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
