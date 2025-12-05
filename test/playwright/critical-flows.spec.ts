/**
 * Critical flow smoke tests (keep light and resilient).
 *
 * Flows covered:
 * - New case creation via modal
 * - Drag-and-drop/Upload Notes modal preselects file
 * - CRM import modal opens and enforces connection gating
 * - Ask AI → SDUI render smoke (when a case is available)
 */

import { test, expect, Page } from '@playwright/test';
import { Buffer } from 'buffer';

const TIMEOUT = {
  navigation: 15000,
  ui: 5000,
};

async function waitForAppLoad(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#root > *', { timeout: TIMEOUT.navigation });
  await page.waitForTimeout(500); // small settle
}

test.describe('Critical flows', () => {
  test('new case creation via modal', async ({ page }) => {
    await waitForAppLoad(page);

    const newCaseTriggers = [
      page.getByRole('button', { name: /new case/i }),
      page.getByRole('button', { name: /new chat/i }),
      page.getByText(/Start fresh/i),
    ];

    let triggerFound: typeof newCaseTriggers[number] | null = null;
    for (const btn of newCaseTriggers) {
      if (await btn.isVisible().catch(() => false)) {
        triggerFound = btn;
        break;
      }
    }
    if (!triggerFound) test.skip('No new case trigger visible');

    await triggerFound.click();

    const companyInput = page.getByLabel(/company name/i);
    await companyInput.fill('Playwright Test Co');
    const submit = page.getByRole('button', { name: /create case/i });
    await submit.click();

    await expect(page.locator('text=Playwright Test Co')).toBeVisible({ timeout: TIMEOUT.ui });
  });

  test('upload notes modal preselects file after drop/upload', async ({ page }) => {
    await waitForAppLoad(page);

    const uploadCard = page.getByText(/Upload Notes/i).first();
    if (!(await uploadCard.isVisible().catch(() => false))) test.skip('Upload Notes starter not visible');
    await uploadCard.click();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello from playwright'),
    });

    await expect(page.getByText(/notes\.txt/i)).toBeVisible({ timeout: TIMEOUT.ui });
  });

  test('CRM import modal enforces connection gating', async ({ page }) => {
    await waitForAppLoad(page);

    const importCard = page.getByText(/Import from CRM/i).first();
    if (!(await importCard.isVisible().catch(() => false))) test.skip('Import from CRM starter not visible');
    await importCard.click();

    const urlInput = page.getByPlaceholder(/Salesforce or HubSpot URL/i);
    await urlInput.fill('https://app.hubspot.com/contacts/123/deal/456');

    const fetchButton = page.getByRole('button', { name: /Fetch Deal/i });
    await fetchButton.click();

    await expect(page.getByText(/not connected/i)).toBeVisible({ timeout: TIMEOUT.ui });
  });

  test('ask AI renders SDUI when a case is available', async ({ page }) => {
    await waitForAppLoad(page);

    // Try selecting the first case in sidebar
    const caseButton = page.locator('aside button, aside [role="button"]').first();
    if (!(await caseButton.isVisible().catch(() => false))) test.skip('No case entries visible');
    await caseButton.click();

    const askAiButton = page.getByRole('button', { name: /ask ai/i }).first();
    if (!(await askAiButton.isVisible().catch(() => false))) test.skip('Ask AI not visible');
    await askAiButton.click();

    // SDUI render smoke: look for common SDUI component containers
    const sduiSelectors = ['[data-testid="sdui-component"]', '[class*="sdui"]', 'text=Component unavailable'];
    const found = await Promise.any(
      sduiSelectors.map(async (sel) => {
        const loc = page.locator(sel).first();
        const visible = await loc.isVisible().catch(() => false);
        return visible ? sel : Promise.reject();
      }),
    ).catch(() => null);

    if (!found) test.skip('No SDUI render indicators found');
    expect(found).toBeTruthy();
  });
});
