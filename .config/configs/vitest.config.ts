/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Re-export unit test configuration with added coverage thresholds for CI
const unitConfig = await import("./vitest.config.unit.ts");

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
        // Accessibility-specific coverage thresholds
        './tests/accessibility/': {
          branches: 90,
          functions: 95,
          lines: 90,
          statements: 90,
        },
        './src/components/': {
          branches: 70,
          functions: 75,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
