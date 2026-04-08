import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  webServer: {
    command: "cd apps/ValyntApp && set FRONTEND_PORT=5173 && pnpm exec vite -- --host 0.0.0.0 --port 5173",
    port: 5173,
    timeout: 120000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
