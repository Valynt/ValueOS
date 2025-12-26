import { defineConfig, devices } from "@playwright/test";

/**
 * SDUI Resilience Suite Configuration
 * Targets: tests/visual, tests/fuzzing, tests/resilience
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "visual/**/*.spec.ts",
    "fuzzing/**/*.spec.ts",
    "resilience/**/*.spec.ts",
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173", // Defaulting to Vite default class
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Assuming the user runs the dev server separately or we want to start it
  // Given we are in a dev container, we'll try to reuse existing or start 'npm run dev'
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
