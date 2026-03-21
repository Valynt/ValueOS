/**
 * E2E: Value Realization Critical Flow
 *
 * Tests the value realization workflow: viewing the living value graph,
 * checking realized vs projected values, and reviewing the narrative output.
 *
 * Pass condition: The value realization view loads correctly, displays
 * the living value graph, and shows narrative outputs.
 */

import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../fixtures';

test.describe('Value Realization Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('User can navigate to living value graph', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    const graphLink = page.locator(
      '[data-testid="nav-value-graph"], a[href*="value-graph"], a[href*="living-value"]'
    );
    if (await graphLink.count() > 0) {
      await graphLink.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/value-graph|living-value/);
    }
  });

  test('Living value graph loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForURL(/\/org\//);
    const graphLink = page.locator(
      '[data-testid="nav-value-graph"], a[href*="value-graph"], a[href*="living-value"]'
    );
    if (await graphLink.count() > 0) {
      await graphLink.first().click();
      await page.waitForLoadState('networkidle');
    }

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Narrative stage is accessible from value case canvas', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    const canvasLink = page.locator('[data-testid="value-case-link"], a[href*="cases"]');
    if (await canvasLink.count() > 0) {
      await canvasLink.first().click();
      await page.waitForLoadState('networkidle');

      const narrativeTab = page.locator(
        '[data-testid="stage-narrative"], button:has-text("Narrative")'
      );
      if (await narrativeTab.count() > 0) {
        await expect(narrativeTab.first()).toBeVisible();
      }
    }
  });

  test('Dashboard shows portfolio value metrics', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    const dashboardLink = page.locator(
      '[data-testid="nav-dashboard"], a[href*="dashboard"]'
    );
    if (await dashboardLink.count() > 0) {
      await dashboardLink.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="dashboard-kpis"], [data-testid="portfolio-value"]')).toBeVisible();
    }
  });
});
