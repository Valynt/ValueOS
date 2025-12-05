import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.MONITOR_BASE_URL || 'https://beta.valuecanvas.example.com';

export default defineConfig({
  testDir: './scripts/synthetic-monitors',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 120000,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
