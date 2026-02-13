import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/a11y-html", open: "never" }],
    ["json", { outputFile: "playwright-report/a11y-results.json" }],
  ],
  use: {
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --dir apps/ValyntApp dev --host 0.0.0.0 --port 4173",
      url: "http://127.0.0.1:4173",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "cd apps/VOSAcademy && NODE_OPTIONS='--import tsx' pnpm vite --host 0.0.0.0 --port 4174",
      url: "http://127.0.0.1:4174",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
