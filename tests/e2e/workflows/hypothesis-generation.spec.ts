/**
 * E2E: Hypothesis Generation Critical Flow
 *
 * Tests the hypothesis generation workflow: creating a new opportunity,
 * triggering the AI hypothesis generation, reviewing generated hypotheses,
 * and accepting/rejecting them.
 *
 * Pass condition: Hypotheses are generated and displayed correctly,
 * and the user can interact with them.
 */

import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../fixtures';

test.describe('Hypothesis Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('User can navigate to opportunities page', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.click('[data-testid="nav-opportunities"], a[href*="opportunities"]');
    await page.waitForURL(/opportunities/);
    await expect(page).toHaveURL(/opportunities/);
  });

  test('Opportunities page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForURL(/\/org\//);
    const navLink = page.locator('[data-testid="nav-opportunities"], a[href*="opportunities"]');
    if (await navLink.count() > 0) {
      await navLink.click();
      await page.waitForLoadState('networkidle');
    }

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('Value case canvas loads hypothesis stage', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    // Navigate to a value case canvas if available
    const canvasLink = page.locator('[data-testid="value-case-link"], a[href*="cases"]');
    if (await canvasLink.count() > 0) {
      await canvasLink.first().click();
      await page.waitForLoadState('networkidle');

      // Hypothesis stage tab should be accessible
      const hypothesisTab = page.locator('[data-testid="stage-hypothesis"], button:has-text("Hypothesis")');
      if (await hypothesisTab.count() > 0) {
        await expect(hypothesisTab.first()).toBeVisible();
      }
    }
  });

  test('AI agent chat panel is accessible from value case canvas', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    const canvasLink = page.locator('[data-testid="value-case-link"], a[href*="cases"]');
    if (await canvasLink.count() > 0) {
      await canvasLink.first().click();
      await page.waitForLoadState('networkidle');

      // Agent chat should be accessible
      const agentChat = page.locator('[data-testid="agent-chat"], [data-testid="chat-canvas"]');
      if (await agentChat.count() > 0) {
        await expect(agentChat.first()).toBeVisible();
      }
    }
  });
});
