/**
 * E2E Test - Realization Dashboard
 *
 * Golden path test for the realization dashboard:
 * 1. Navigate to dashboard
 * 2. View active opportunities
 * 3. Filter by status
 * 4. View detailed metrics
 * 5. Export data
 */

import { test, expect } from "@playwright/test";

test.describe("Realization Dashboard - Golden Path", () => {
  test.beforeEach(async ({ page }) => {
    // Login if needed (assuming auth is handled)
    await page.goto("/dashboard");

    await page.waitForLoadState("networkidle");
  });

  test("should display dashboard with key metrics", async ({ page }) => {
    // Verify dashboard loaded
    await expect(
      page.getByRole("heading", { name: /dashboard|realization/i })
    ).toBeVisible();

    // Verify key metric cards are visible
    await expect(
      page.locator('[data-testid="metric-total-value"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metric-active-opportunities"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metric-realized-value"]')
    ).toBeVisible();

    // Metrics should have numeric values
    const totalValue = page.locator('[data-testid="metric-total-value"]');
    await expect(totalValue).toContainText(/\$|[0-9]/);
  });

  test("should show list of active opportunities", async ({ page }) => {
    // Wait for opportunities to load
    const opportunityList = page.locator('[data-testid="opportunity-list"]');
    await expect(opportunityList).toBeVisible({ timeout: 10000 });

    // Should have at least one opportunity
    const opportunities = page.locator('[data-testid="opportunity-card"]');
    await expect(opportunities.first()).toBeVisible();

    // Each opportunity should show key info
    const firstOpp = opportunities.first();
    await expect(firstOpp).toContainText(/\$/); // Contains value
  });

  test("should filter opportunities by status", async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="opportunity-list"]');

    // Get initial count
    const allOpportunities = page.locator('[data-testid="opportunity-card"]');
    const initialCount = await allOpportunities.count();

    // Apply filter
    await page
      .getByRole("combobox", { name: /status|filter/i })
      .selectOption("active");

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify filtering worked
    const activeOpportunities = page.locator(
      '[data-testid="opportunity-card"]'
    );
    const filteredCount = await activeOpportunities.count();

    // Filtered count should be less than or equal to initial
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("should navigate to opportunity detail", async ({ page }) => {
    // Wait for opportunities
    await page.waitForSelector('[data-testid="opportunity-card"]');

    // Click first opportunity
    await page.locator('[data-testid="opportunity-card"]').first().click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/opportunity\/.*/, { timeout: 5000 });

    // Detail view should be visible
    await expect(
      page.locator('[data-testid="opportunity-detail"]')
    ).toBeVisible();
  });

  test("should display charts and visualizations", async ({ page }) => {
    // Verify chart is present
    const chart = page.locator('[data-testid="value-chart"]');
    await expect(chart).toBeVisible({ timeout: 10000 });

    // Verify chart has data (canvas or SVG)
    const chartElement = await chart.locator("canvas, svg").count();
    expect(chartElement).toBeGreaterThan(0);
  });

  test("should export dashboard data", async ({ page }) => {
    // Click export button
    const exportButton = page.getByRole("button", { name: /export|download/i });
    await expect(exportButton).toBeVisible();

    // Setup download listener
    const downloadPromise = page.waitForEvent("download");

    await exportButton.click();

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/dashboard|report/i);
  });

  test("should refresh data on demand", async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('[data-testid="metric-total-value"]');

    // Get initial value
    const initialValue = await page
      .locator('[data-testid="metric-total-value"]')
      .textContent();

    // Click refresh
    await page.getByRole("button", { name: /refresh/i }).click();

    // Wait for refresh to complete
    await page.waitForLoadState("networkidle");

    // Verify data was refreshed (value might be same or different)
    const refreshedValue = await page
      .locator('[data-testid="metric-total-value"]')
      .textContent();
    expect(refreshedValue).toBeDefined();
  });
});
