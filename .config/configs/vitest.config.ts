/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Re-export unit test configuration with added coverage thresholds for CI
const unitConfig = await import("./.config/configs/vitest.config.unit.ts");

export default defineConfig({
  ...unitConfig.default,
  test: {
    ...unitConfig.default.test,
    coverage: {
      ...unitConfig.default.test?.coverage,
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        global: {
          branches: 65,
          functions: 70,
          lines: 75,
          statements: 75,
        },
      },
    },
  },
});
