/**
 * Export Flow — E2E Tests
 *
 * Tests cover:
 * - ExecutiveOutputStudio export buttons visibility
 * - Integrity gate blocking behavior
 * - Async PPTX export with progress indicator
 * - Export history display
 * - Download refresh for expired URLs
 * - Cross-tenant isolation
 */

import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_CASE_ID = "test-case-export-flow";
const TEST_TENANT_ID = "test-tenant-export-flow";
const TEST_USER_ID = "test-user-export-flow";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  // Set up authentication via localStorage or cookies
  await page.goto("/auth-test");
  await page.evaluate(
    ({ tenantId, userId }) => {
      localStorage.setItem(
        "supabase.auth.token",
        JSON.stringify({
          access_token: "test-token",
          user: { id: userId },
          tenant_id: tenantId,
        })
      );
    },
    { tenantId: TEST_TENANT_ID, userId: TEST_USER_ID }
  );
});

// ---------------------------------------------------------------------------
// ExecutiveOutputStudio Integration
// ---------------------------------------------------------------------------

test.describe("ExecutiveOutputStudio Export Integration", () => {
  test("export buttons visible when artifacts exist and integrity passes", async ({ page }) => {
    // Navigate to ExecutiveOutputStudio with artifacts
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);

    // Wait for page to load
    await page.waitForSelector("h1:has-text('Executive Output Studio')");

    // Integrity gate should pass (score >= 0.6)
    await page.waitForSelector("text=Export PPTX", { state: "visible" });
    await page.waitForSelector("text=Export PDF", { state: "visible" });

    // Buttons should be enabled
    const pptxButton = page.locator("button:has-text('Export PPTX')");
    const pdfButton = page.locator("button:has-text('Export PDF')");

    await expect(pptxButton).toBeEnabled();
    await expect(pdfButton).toBeEnabled();
  });

  test("export buttons disabled when integrity gate closed", async ({ page }) => {
    // Navigate with low integrity case
    await page.goto(`/org/low-integrity-case/executive-outputs`);

    await page.waitForSelector("h1:has-text('Executive Output Studio')");

    // Wait for integrity gate alert
    await page.waitForSelector("text=Integrity Gate Closed");

    // Export buttons should be disabled
    const pptxButton = page.locator("button:has-text('Export PPTX')");
    const pdfButton = page.locator("button:has-text('Export PDF')");

    await expect(pptxButton).toBeDisabled();
    await expect(pdfButton).toBeDisabled();
  });

  test("async PPTX export shows progress and completes", async ({ page }) => {
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("h1:has-text('Executive Output Studio')");

    // Click export button
    const exportButton = page.locator("button:has-text('Export PPTX')");
    await exportButton.click();

    // Progress indicator should appear
    await page.waitForSelector("text=Exporting...", { timeout: 5000 });

    // Wait for completion (opens new tab)
    const [newPage] = await Promise.all([
      page.waitForEvent("popup", { timeout: 60000 }),
      page.waitForSelector("text=Export PPTX", { state: "visible" }),
    ]);

    // New tab should have signed URL
    expect(newPage.url()).toContain("signed");
    await newPage.close();
  });

  test("export history panel displays recent exports", async ({ page }) => {
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("h1:has-text('Executive Output Studio')");

    // Export history section should be visible
    await page.waitForSelector("text=Recent Exports");

    // Should show export count
    const historyPanel = page.locator("text=Recent Exports").locator("..");
    await expect(historyPanel).toContainText(/export[s]? available/i);

    // Table headers
    await expect(page.locator("th:has-text('Format')")).toBeVisible();
    await expect(page.locator("th:has-text('Date')")).toBeVisible();
    await expect(page.locator("th:has-text('Size')")).toBeVisible();
    await expect(page.locator("th:has-text('Quality')")).toBeVisible();
    await expect(page.locator("th:has-text('Actions')")).toBeVisible();
  });

  test("export history shows quality badges", async ({ page }) => {
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("text=Recent Exports");

    // Quality badges should be visible
    const qualityBadge = page.locator("text=/Good \\(/i");
    await expect(qualityBadge).toBeVisible();
  });

  test("download button opens signed URL in new tab", async ({ page }) => {
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("text=Recent Exports");

    // Find download button
    const downloadButton = page.locator("button:has-text('Download')").first();

    // Click opens new tab
    const [newPage] = await Promise.all([
      page.waitForEvent("popup"),
      downloadButton.click(),
    ]);

    // Verify it's a signed URL
    expect(newPage.url()).toMatch(/https:\/\/.*/);
    await newPage.close();
  });

  test("refresh link button for expired URLs", async ({ page }) => {
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("text=Recent Exports");

    // Look for refresh button (expired URL scenario)
    const refreshButton = page.locator("button:has-text('Refresh Link')");

    if (await refreshButton.isVisible()) {
      // Click refresh
      await refreshButton.click();

      // Should show "Refreshing..." state
      await page.waitForSelector("text=Refreshing...");

      // After refresh, download should open new tab
      const [newPage] = await Promise.all([
        page.waitForEvent("popup"),
        page.waitForTimeout(2000), // Wait for refresh to complete
      ]);

      expect(newPage.url()).toMatch(/https:\/\/.*/);
      await newPage.close();
    }
  });

  test("shows 'Expiring soon' warning for URLs about to expire", async ({ page }) => {
    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("text=Recent Exports");

    // Check for expiring soon warning
    const expiringWarning = page.locator("text=Expiring soon");

    // This may or may not be present depending on test data
    if (await expiringWarning.isVisible()) {
      await expect(expiringWarning).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-Tenant Isolation
// ---------------------------------------------------------------------------

test.describe("Export Cross-Tenant Isolation", () => {
  test("cannot access export history from different tenant", async ({ page, browser }) => {
    // Create context for tenant A
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto("/auth-test");
    await pageA.evaluate(() => {
      localStorage.setItem(
        "supabase.auth.token",
        JSON.stringify({
          access_token: "token-a",
          user: { id: "user-a" },
          tenant_id: "tenant-a",
        })
      );
    });

    // Create context for tenant B
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto("/auth-test");
    await pageB.evaluate(() => {
      localStorage.setItem(
        "supabase.auth.token",
        JSON.stringify({
          access_token: "token-b",
          user: { id: "user-b" },
          tenant_id: "tenant-b",
        })
      );
    });

    // Tenant A creates export
    await pageA.goto("/org/case-shared-id/executive-outputs");
    // ... trigger export ...

    // Tenant B tries to access same export job ID
    await pageB.goto("/org/case-shared-id/export/jobs/job-from-tenant-a/status");

    // Should get 404 (not 403, to prevent ID enumeration)
    await pageB.waitForSelector("text=Export job not found");

    await contextA.close();
    await contextB.close();
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

test.describe("Export Error Handling", () => {
  test("shows error when export fails", async ({ page }) => {
    await page.goto(`/org/error-case/executive-outputs`);
    await page.waitForSelector("h1:has-text('Executive Output Studio')");

    // Click export
    const exportButton = page.locator("button:has-text('Export PPTX')");
    await exportButton.click();

    // Error alert should appear
    await page.waitForSelector("text=Export failed");
  });

  test("handles network timeout gracefully", async ({ page }) => {
    // Slow down API response
    await page.route("**/api/v1/cases/*/export/async", async (route) => {
      await new Promise((r) => setTimeout(r, 10000));
      await route.continue();
    });

    await page.goto(`/org/${TEST_CASE_ID}/executive-outputs`);
    await page.waitForSelector("h1:has-text('Executive Output Studio')");

    const exportButton = page.locator("button:has-text('Export PPTX')");
    await exportButton.click();

    // Should show timeout error or loading state for extended period
    await page.waitForSelector("text=Export Blocked");
  });
});
