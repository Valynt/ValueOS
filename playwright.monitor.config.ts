import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts/synthetic-monitors",
  fullyParallel: false, // Run serially for memory monitoring
  retries: 0,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "cd apps/ValyntApp && pnpm run dev --port 5174",
    port: 5174,
    timeout: 120000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    headless: true, // Run headless for CI
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Global timeout for the entire test run (5 minutes per test * 50 iterations + setup)
  globalTimeout: 300000 * 50 + 60000, // 5 minutes * 50 + 1 minute buffer
});
