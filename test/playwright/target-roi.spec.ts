/**
 * E2E Test - Target ROI Flow
 *
 * Golden path test for calculating and viewing ROI targets:
 * 1. Navigate to target page
 * 2. Enter deal parameters
 * 3. Agent calculates ROI
 * 4. View ROI breakdown
 * 5. Adjust parameters and recalculate
 */

import { expect, test } from "@playwright/test";

test.describe("Target ROI Flow - Golden Path", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to target/ROI page
    await page.goto("/target");

    await page.waitForLoadState("networkidle");
  });

  test("should complete target ROI calculation end-to-end", async ({
    page,
  }) => {
    // Step 1: Enter deal parameters
    await page.getByLabel(/deal size/i).fill("100000");
    await page.getByLabel(/time period/i).fill("12");
    await page.getByLabel(/discount rate/i).fill("10");

    // Step 2: Submit for calculation
    await page.getByRole("button", { name: /calculate roi/i }).click();

    // Step 3: Wait for agent to process
    await page.waitForSelector('[data-testid="roi-result"]', {
      timeout: 15000,
    });

    // Step 4: Verify ROI is displayed
    const roiResult = page.locator('[data-testid="roi-result"]');
    await expect(roiResult).toBeVisible();

    // Should show percentage
    await expect(roiResult).toContainText(/%/);

    // Step 5: Verify breakdown sections
    await expect(page.getByText(/investment value/i)).toBeVisible();
    await expect(page.getByText(/expected return/i)).toBeVisible();
    await expect(page.getByText(/payback period/i)).toBeVisible();
  });

  test("should show ROI visualization", async ({ page }) => {
    // Enter parameters
    await page.getByLabel(/deal size/i).fill("50000");
    await page.getByLabel(/time period/i).fill("24");

    await page.getByRole("button", { name: /calculate roi/i }).click();

    await page.waitForSelector('[data-testid="roi-result"]', {
      timeout: 15000,
    });

    // Verify chart/visualization is displayed
    const chart = page.locator('[data-testid="roi-chart"]');
    await expect(chart).toBeVisible();
  });

  test("should allow adjusting parameters and recalculating", async ({
    page,
  }) => {
    // Initial calculation
    await page.getByLabel(/deal size/i).fill("100000");
    await page.getByRole("button", { name: /calculate roi/i }).click();

    await page.waitForSelector('[data-testid="roi-result"]', {
      timeout: 15000,
    });

    const initialROI = await page
      .locator('[data-testid="roi-result"]')
      .textContent();

    // Adjust parameters
    await page.getByLabel(/deal size/i).fill("200000");
    await page.getByRole("button", { name: /calculate roi/i }).click();

    await page.waitForSelector('[data-testid="roi-result"]', {
      timeout: 15000,
    });

    const newROI = await page
      .locator('[data-testid="roi-result"]')
      .textContent();

    // ROI should be different after adjustment
    expect(newROI).not.toBe(initialROI);
  });

  test("should validate input parameters", async ({ page }) => {
    // Try negative value
    await page.getByLabel(/deal size/i).fill("-1000");
    await page.getByRole("button", { name: /calculate roi/i }).click();

    // Should show validation error
    await expect(
      page.getByText(/must be positive|invalid amount/i)
    ).toBeVisible();
  });

  test("should save ROI calculation to history", async ({ page }) => {
    // Complete calculation
    await page.getByLabel(/deal size/i).fill("100000");
    await page.getByRole("button", { name: /calculate roi/i }).click();

    await page.waitForSelector('[data-testid="roi-result"]', {
      timeout: 15000,
    });

    // Navigate to history
    await page
      .getByRole("link", { name: /history|past calculations/i })
      .click();

    // Verify calculation appears in history
    await expect(page.getByText(/\$100,000/)).toBeVisible();
  });
});
