import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Main layout skip link', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/__playwright__/main-layout');
    await page.waitForLoadState('networkidle');
  });

  test('first Tab exposes the skip link and axe reports no violations', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /skip to main content/i });

    await page.keyboard.press('Tab');

    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Enter and Space move focus to the main region', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    const main = page.getByRole('main');

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(main).toBeFocused();
    await expect(main).toHaveAttribute('id', 'main-content');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Space');

    await expect(main).toBeFocused();
  });
});
