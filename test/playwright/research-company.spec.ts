/**
 * E2E Test - Research Company Flow
 *
 * Golden path test for the Research Company workflow:
 * 1. Navigate to launch page
 * 2. Enter company name
 * 3. Agent generates hypotheses
 * 4. Click hypothesis to drill down
 * 5. Verify detailed view
 */

import { expect, test } from "@playwright/test";

test.describe("Research Company Flow - Golden Path", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the launch page
    await page.goto("/launch");

    // Wait for page to be ready
    await page.waitForLoadState("networkidle");
  });

  test("should complete research company workflow end-to-end", async ({
    page,
  }) => {
    // Step 1: Enter company name in search
    const companyInput = page.getByPlaceholder(/company name/i);
    await expect(companyInput).toBeVisible();

    await companyInput.fill("Nike");
    await companyInput.press("Enter");

    // Step 2: Wait for agent to generate hypotheses
    await page.waitForSelector('[data-testid="hypothesis-card"]', {
      timeout: 30000, // Agent may take time to generate
    });

    // Verify hypotheses are displayed
    const hypothesisCards = page.locator('[data-testid="hypothesis-card"]');
    await expect(hypothesisCards).toHaveCount(3, { timeout: 10000 });

    // Step 3: Verify hypothesis content
    const firstHypothesis = hypothesisCards.first();
    await expect(firstHypothesis).toContainText(/Nike|Athletic/i);

    // Step 4: Click first hypothesis to drill down
    await firstHypothesis.click();

    // Step 5: Verify detailed view loaded
    await expect(page).toHaveURL(/\/hypothesis\/.*/, { timeout: 10000 });

    // Verify detailed content is displayed
    const detailView = page.locator('[data-testid="hypothesis-detail"]');
    await expect(detailView).toBeVisible();

    // Verify key sections are present
    await expect(
      page.getByRole("heading", { name: /opportunity/i })
    ).toBeVisible();
    await expect(page.getByText(/value proposition/i)).toBeVisible();
  });

  test("should show loading state while agent processes", async ({ page }) => {
    // Enter company name
    await page.getByPlaceholder(/company name/i).fill("Apple");
    await page.getByPlaceholder(/company name/i).press("Enter");

    // Verify loading indicator appears
    const loadingIndicator = page.locator('[aria-label="Loading"]');
    await expect(loadingIndicator).toBeVisible({ timeout: 1000 });

    // Loading should eventually complete
    await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
  });

  test("should handle empty search gracefully", async ({ page }) => {
    // Try to submit without entering company name
    await page.getByPlaceholder(/company name/i).press("Enter");

    // Should show validation message
    await expect(page.getByText(/company name is required/i)).toBeVisible();
  });

  test("should allow user to go back and search again", async ({ page }) => {
    // First search
    await page.getByPlaceholder(/company name/i).fill("Nike");
    await page.getByPlaceholder(/company name/i).press("Enter");

    await page.waitForSelector('[data-testid="hypothesis-card"]', {
      timeout: 30000,
    });

    // Navigate back
    await page.getByRole("button", { name: /back|new search/i }).click();

    // Should be back on launch page
    await expect(page).toHaveURL("/launch");

    // Input should be cleared or ready for new search
    const input = page.getByPlaceholder(/company name/i);
    await expect(input).toBeVisible();
  });

  test("should persist session across page refresh", async ({ page }) => {
    // Complete a search
    await page.getByPlaceholder(/company name/i).fill("Microsoft");
    await page.getByPlaceholder(/company name/i).press("Enter");

    await page.waitForSelector('[data-testid="hypothesis-card"]', {
      timeout: 30000,
    });

    // Refresh the page
    await page.reload();

    // Session should be restored
    await expect(page.locator('[data-testid="hypothesis-card"]')).toHaveCount(
      3,
      {
        timeout: 10000,
      }
    );
  });
});
