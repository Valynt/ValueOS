import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Increase timeouts for container environments
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable headless mode by default (can be overridden with --headed flag)
        headless: process.env.CI ? true : false,
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        headless: process.env.CI ? true : false,
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        headless: process.env.CI ? true : false,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for server to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
