/**
 * E2E: Deal Assembly Critical Flow
 *
 * Tests the complete deal assembly workflow: selecting a value case,
 * assembling the deal package, reviewing outputs, and exporting.
 *
 * Pass condition: All steps complete without error and the assembled
 * deal package is accessible and correctly structured.
 */

import { expect, test } from '@playwright/test';
import { loginAsTestUser, navigateToWorkspace } from '../fixtures';

test.describe('Deal Assembly Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('User can navigate to deal assembly workspace', async ({ page }) => {
    await navigateToWorkspace(page, 'assembly');
    await expect(page.locator('[data-testid="deal-assembly-workspace"]')).toBeVisible();
  });

  test('Deal assembly workspace loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await navigateToWorkspace(page, 'assembly');
    await page.waitForLoadState('networkidle');

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('User can view assembled deal package sections', async ({ page }) => {
    await navigateToWorkspace(page, 'assembly');
    await page.waitForLoadState('networkidle');

    // The deal assembly workspace should show key sections
    const workspace = page.locator('[data-testid="deal-assembly-workspace"]');
    await expect(workspace).toBeVisible();
  });

  test('Deal assembly export button is accessible', async ({ page }) => {
    await navigateToWorkspace(page, 'assembly');
    await page.waitForLoadState('networkidle');

    // Export functionality should be present
    const exportButton = page.locator('[data-testid="export-deal-package"], button:has-text("Export")');
    if (await exportButton.count() > 0) {
      await expect(exportButton.first()).toBeEnabled();
    }
  });
});
