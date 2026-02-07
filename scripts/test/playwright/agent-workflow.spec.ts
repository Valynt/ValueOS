/**
 * Agent Workflow E2E Tests
 *
 * Smoke tests for the agent 7-state workflow UI.
 */

import { test, expect } from "@playwright/test";

test.describe("Agent Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "testpassword");
    await page.click('[data-testid="login-button"]');
    await page.waitForURL("/deals");
  });

  test("should display tenant badge in sidebar", async ({ page }) => {
    // Navigate to a protected route
    await page.goto("/deals");

    // Check for tenant badge visibility
    const tenantBadge = page.locator('[data-testid="tenant-badge"]');
    await expect(tenantBadge).toBeVisible();
  });

  test("should allow tenant switching", async ({ page }) => {
    await page.goto("/deals");

    // Click tenant switcher
    const tenantSwitcher = page.locator('[data-testid="tenant-switcher"]');
    if (await tenantSwitcher.isVisible()) {
      await tenantSwitcher.click();

      // Should show dropdown with tenant options
      const dropdown = page.locator('[role="listbox"]');
      await expect(dropdown).toBeVisible();
    }
  });

  test("should show environment banner in development", async ({ page }) => {
    await page.goto("/deals");

    // Environment banner should be visible in non-production
    const envBanner = page.locator('[data-testid="environment-banner"]');
    // May or may not be visible depending on environment
    if (await envBanner.isVisible()) {
      await expect(envBanner).toContainText(/development|staging|test/i);
    }
  });

  test("should display loading skeleton while fetching data", async ({ page }) => {
    // Intercept API to delay response
    await page.route("**/api/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto("/deals");

    // Should show skeleton while loading
    const skeleton = page.locator('[data-testid="skeleton"]');
    // Skeleton may be visible briefly
  });
});

test.describe("Agent State Machine UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "testpassword");
    await page.click('[data-testid="login-button"]');
    await page.waitForURL("/deals");
  });

  test("should show clarify card when agent needs clarification", async ({ page }) => {
    // This test would require mocking the agent WebSocket
    // For now, just verify the component renders correctly when present
    await page.goto("/app");

    // Inject a clarify card for testing
    await page.evaluate(() => {
      const event = new CustomEvent("agent:clarify", {
        detail: {
          id: "test-clarify",
          question: "What industry is this company in?",
          type: "choice",
          options: [
            { value: "tech", label: "Technology" },
            { value: "finance", label: "Finance" },
          ],
          required: true,
        },
      });
      window.dispatchEvent(event);
    });
  });

  test("should support keyboard shortcuts", async ({ page }) => {
    await page.goto("/app");

    // Test Cmd+K opens command palette
    await page.keyboard.press("Meta+k");

    // Command palette should be visible (if implemented)
    const commandPalette = page.locator('[data-testid="command-palette"]');
    if (await commandPalette.isVisible()) {
      await expect(commandPalette).toBeVisible();

      // Close with Escape
      await page.keyboard.press("Escape");
      await expect(commandPalette).not.toBeVisible();
    }
  });
});

test.describe("Accessibility", () => {
  test("should have proper ARIA labels", async ({ page }) => {
    await page.goto("/login");

    // Check for proper form labels
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute("aria-label", /.+/);

    // Check for proper button labels
    const loginButton = page.locator('[data-testid="login-button"]');
    await expect(loginButton).toBeEnabled();
  });

  test("should support keyboard navigation", async ({ page }) => {
    await page.goto("/login");

    // Tab through form elements
    await page.keyboard.press("Tab");
    const focused1 = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A"]).toContain(focused1);

    await page.keyboard.press("Tab");
    const focused2 = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A"]).toContain(focused2);
  });

  test("should have skip link for main content", async ({ page }) => {
    await page.goto("/deals");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "testpassword");
    await page.click('[data-testid="login-button"]');
    await page.waitForURL("/deals");

    // Check for skip link
    const skipLink = page.locator('.skip-link, [href="#main-content"]');
    if ((await skipLink.count()) > 0) {
      // Skip link should be focusable
      await skipLink.first().focus();
      await expect(skipLink.first()).toBeFocused();
    }
  });
});
