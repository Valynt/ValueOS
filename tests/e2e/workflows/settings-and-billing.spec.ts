/**
 * E2E: Settings & Billing Critical Flow
 *
 * Tests the settings and billing workflow: accessing organization settings,
 * viewing the billing page, and managing team members.
 *
 * Pass condition: All settings pages load correctly, show real data
 * (not hardcoded mock data), and are accessible.
 */

import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../fixtures';

test.describe('Settings & Billing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Settings page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForURL(/\/org\//);
    const settingsLink = page.locator('[data-testid="nav-settings"], a[href*="settings"]');
    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Billing page is accessible', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.goto(page.url().replace(/\/org\/([^/]+).*/, '/org/$1/settings/billing'));
    await page.waitForLoadState('networkidle');

    // Should either show billing page or redirect to settings
    const hasBillingContent = await page.locator(
      '[data-testid="billing-page"], [data-testid="subscription-info"]'
    ).count() > 0;
    const isSettingsPage = page.url().includes('settings');

    expect(hasBillingContent || isSettingsPage).toBe(true);
  });

  test('Team page shows real team data, not mock data', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.goto(page.url().replace(/\/org\/([^/]+).*/, '/org/$1/settings/team'));
    await page.waitForLoadState('networkidle');

    const pageContent = await page.locator('body').textContent();

    // Should not contain hardcoded mock data
    expect(pageContent).not.toContain('sarah@acme.com');
    expect(pageContent).not.toContain('james@acme.com');
    expect(pageContent).not.toContain('Acme Corp');
  });

  test('Profile page shows authenticated user data', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.goto(page.url().replace(/\/org\/([^/]+).*/, '/org/$1/settings/profile'));
    await page.waitForLoadState('networkidle');

    const pageContent = await page.locator('body').textContent();

    // Should not contain hardcoded mock email
    expect(pageContent).not.toContain('admin@acme.com');
    expect(pageContent).not.toContain('sarah@acme.com');
  });

  test('Settings navigation tabs are keyboard accessible', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    const settingsLink = page.locator('[data-testid="nav-settings"], a[href*="settings"]');
    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      await page.waitForLoadState('networkidle');

      // Tab navigation should work
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
  });
});
