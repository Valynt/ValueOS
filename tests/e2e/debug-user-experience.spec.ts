import { test, expect } from '@playwright/test';

test.describe('User Experience Debugging', () => {
  test.describe.configure({ mode: 'serial' });

  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Navigate to login page', async () => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=Login')).toBeVisible({ timeout: 10000 });
  });

  test('Test login with provided credentials', async () => {
    // Fill login form
    await page.fill('input[name="email"]', 'demouser@valynt.com');
    await page.fill('input[name="password"]', 'passw0rd');

    // Click login button
    await page.click('text=Login');

    // Wait for dashboard to load
    await page.waitForTimeout(2000);
  });

  test('Verify successful login and dashboard accessibility', async () => {
    // Check for dashboard elements
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Check for key navigation elements
    await expect(page.locator('text=Agents')).toBeVisible();
    await expect(page.locator('text=Chat')).toBeVisible();
    await expect(page.locator('text=Modeling')).toBeVisible();
  });

  test('Test key user interactions', async () => {
    // Test navigation to Agents tab
    await page.click('text=Agents');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Available Agents')).toBeVisible();

    // Test navigation to Chat tab
    await page.click('text=Chat');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Start a new conversation')).toBeVisible();

    // Test navigation to Modeling tab
    await page.click('text=Modeling');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Value Modeling')).toBeVisible();
  });

  test('Check for any console errors', async () => {
    const consoleMessages = await page.evaluate(() => {
      return window.console.logs;
    });

    // Filter out expected messages
    const errors = consoleMessages.filter(msg =>
      msg.level === 'error' && !msg.text.includes('Expected')
    );

    expect(errors).toHaveLength(0);
  });
});
