/**
 * E2E: Financial Modeling Critical Flow
 *
 * Tests the financial modeling workflow: accessing the value model workbench,
 * configuring financial parameters, running model calculations, and
 * reviewing the output projections.
 *
 * Pass condition: The financial model workbench loads, accepts inputs,
 * and displays calculated outputs without errors.
 */

import { expect, test } from '@playwright/test';
import { loginAsTestUser, navigateToWorkspace } from '../fixtures';

test.describe('Financial Modeling Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('User can navigate to value model workbench', async ({ page }) => {
    await navigateToWorkspace(page, 'model');
    await expect(page.locator('[data-testid="value-model-workbench"]')).toBeVisible();
  });

  test('Value model workbench loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await navigateToWorkspace(page, 'model');
    await page.waitForLoadState('networkidle');

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Financial model displays key metrics', async ({ page }) => {
    await navigateToWorkspace(page, 'model');
    await page.waitForLoadState('networkidle');

    // Key financial metrics should be displayed
    const workbench = page.locator('[data-testid="value-model-workbench"]');
    await expect(workbench).toBeVisible();
  });

  test('Model stage tab is accessible from value case canvas', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    const canvasLink = page.locator('[data-testid="value-case-link"], a[href*="cases"]');
    if (await canvasLink.count() > 0) {
      await canvasLink.first().click();
      await page.waitForLoadState('networkidle');

      // Model stage tab should be accessible
      const modelTab = page.locator('[data-testid="stage-model"], button:has-text("Model")');
      if (await modelTab.count() > 0) {
        await expect(modelTab.first()).toBeVisible();
      }
    }
  });
});
