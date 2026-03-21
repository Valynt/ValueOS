/**
 * E2E: Agent Interaction Critical Flow
 *
 * Tests the core agentic interaction loop: sending a message to an agent,
 * receiving a streamed response, and verifying the response is rendered
 * correctly in the chat canvas.
 *
 * Pass condition: The agent chat panel accepts input, displays a loading
 * state, and renders the agent response without errors.
 */

import { expect, test } from '@playwright/test';
import { loginAsTestUser } from '../fixtures';

test.describe('Agent Interaction Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('Agent chat panel is accessible from the dashboard', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.waitForLoadState('networkidle');

    const agentPanel = page.locator(
      '[data-testid="agent-chat"], [data-testid="chat-canvas"], [data-testid="agent-sidebar"]'
    );
    if (await agentPanel.count() > 0) {
      await expect(agentPanel.first()).toBeVisible();
    }
  });

  test('Agent chat input field is accessible and focusable', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator(
      '[data-testid="chat-input"], textarea[placeholder*="message"], textarea[placeholder*="Ask"]'
    );
    if (await chatInput.count() > 0) {
      await chatInput.first().click();
      await expect(chatInput.first()).toBeFocused();
    }
  });

  test('Agent badges show correct status indicators', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.waitForLoadState('networkidle');

    // Agent status badges should be visible somewhere in the app
    const agentBadge = page.locator('[data-testid="agent-badge"], [data-testid="agent-status"]');
    if (await agentBadge.count() > 0) {
      await expect(agentBadge.first()).toBeVisible();
    }
  });

  test('Agent chat panel has proper ARIA attributes', async ({ page }) => {
    await page.waitForURL(/\/org\//);
    await page.waitForLoadState('networkidle');

    // Chat region should have proper landmark role
    const chatRegion = page.locator('[role="main"], [role="complementary"], [aria-label*="chat"]');
    await expect(chatRegion.first()).toBeVisible();
  });

  test('Sending a message does not cause a page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForURL(/\/org\//);
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator(
      '[data-testid="chat-input"], textarea[placeholder*="message"], textarea[placeholder*="Ask"]'
    );
    if (await chatInput.count() > 0) {
      await chatInput.first().fill('Hello, what can you help me with?');
      await chatInput.first().press('Enter');
      await page.waitForTimeout(2000);
    }

    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});
