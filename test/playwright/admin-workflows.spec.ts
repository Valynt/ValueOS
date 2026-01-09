/**
 * E2E Test - Admin Workflows
 *
 * Golden path tests for admin functionality:
 * 1. User management
 * 2. Tenant configuration
 * 3. Audit log viewing
 */

import { expect, test } from "@playwright/test";

test.describe("Admin Workflows - Golden Path", () => {
  test.use({
    storageState: "test/playwright/.auth/admin.json", // Pre-authenticated admin
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test.describe("User Management", () => {
    test("should list all users in tenant", async ({ page }) => {
      // Navigate to users section
      await page.getByRole("link", { name: /users/i }).click();

      // Verify user list loads
      const userTable = page.locator('[data-testid="user-table"]');
      await expect(userTable).toBeVisible({ timeout: 10000 });

      // Should have table headers
      await expect(
        page.getByRole("columnheader", { name: /email/i })
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /role/i })
      ).toBeVisible();

      // Should have at least one user row
      const userRows = page.locator('[data-testid="user-row"]');
      await expect(userRows.first()).toBeVisible();
    });

    test("should create new user", async ({ page }) => {
      await page.getByRole("link", { name: /users/i }).click();

      // Click add user button
      await page.getByRole("button", { name: /add user|new user/i }).click();

      // Fill user form
      await page.getByLabel(/email/i).fill("newuser@example.com");
      await page.getByLabel(/role/i).selectOption("user");

      // Submit form
      await page.getByRole("button", { name: /create|save/i }).click();

      // Verify success message
      await expect(
        page.getByText(/user created|successfully added/i)
      ).toBeVisible();

      // New user should appear in list
      await expect(page.getByText("newuser@example.com")).toBeVisible();
    });

    test("should update user role", async ({ page }) => {
      await page.getByRole("link", { name: /users/i }).click();

      // Find first user row
      const firstUser = page.locator('[data-testid="user-row"]').first();

      // Click edit button
      await firstUser.getByRole("button", { name: /edit/i }).click();

      // Change role
      await page.getByLabel(/role/i).selectOption("admin");

      // Save changes
      await page.getByRole("button", { name: /save|update/i }).click();

      // Verify success
      await expect(page.getByText(/updated|saved/i)).toBeVisible();
    });
  });

  test.describe("Tenant Configuration", () => {
    test("should view and update tenant settings", async ({ page }) => {
      // Navigate to settings
      await page.getByRole("link", { name: /settings|configuration/i }).click();

      // Verify settings form loaded
      await expect(page.getByLabel(/tenant name/i)).toBeVisible();

      // Update setting
      await page.getByLabel(/tenant name/i).fill("Updated Tenant Name");

      // Save changes
      await page.getByRole("button", { name: /save/i }).click();

      // Verify success
      await expect(page.getByText(/saved|updated/i)).toBeVisible();
    });

    test("should configure feature flags", async ({ page }) => {
      await page.getByRole("link", { name: /settings/i }).click();

      // Navigate to features tab
      await page.getByRole("tab", { name: /features/i }).click();

      // Toggle a feature flag
      const featureToggle = page
        .locator('[data-testid="feature-toggle"]')
        .first();
      await featureToggle.click();

      // Save changes
      await page.getByRole("button", { name: /save/i }).click();

      // Verify success
      await expect(page.getByText(/saved/i)).toBeVisible();
    });
  });

  test.describe("Audit Log", () => {
    test("should view audit log entries", async ({ page }) => {
      // Navigate to audit log
      await page.getByRole("link", { name: /audit|logs/i }).click();

      // Verify audit log table loads
      const auditTable = page.locator('[data-testid="audit-table"]');
      await expect(auditTable).toBeVisible({ timeout: 10000 });

      // Should have entries
      const logEntries = page.locator('[data-testid="audit-entry"]');
      await expect(logEntries.first()).toBeVisible();

      // Each entry should show key information
      const firstEntry = logEntries.first();
      await expect(firstEntry).toContainText(/user|action|timestamp/i);
    });

    test("should filter audit log by action type", async ({ page }) => {
      await page.getByRole("link", { name: /audit/i }).click();

      // Wait for log to load
      await page.waitForSelector('[data-testid="audit-table"]');

      // Apply filter
      await page
        .getByRole("combobox", { name: /action|filter/i })
        .selectOption("user.created");

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Verify filtered results
      const entries = page.locator('[data-testid="audit-entry"]');
      const firstEntry = await entries.first().textContent();
      expect(firstEntry).toContain("created");
    });

    test("should export audit log", async ({ page }) => {
      await page.getByRole("link", { name: /audit/i }).click();

      // Setup download listener
      const downloadPromise = page.waitForEvent("download");

      // Click export
      await page.getByRole("button", { name: /export/i }).click();

      // Verify download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/audit|log/i);
    });
  });
});
