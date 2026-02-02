import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
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
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
