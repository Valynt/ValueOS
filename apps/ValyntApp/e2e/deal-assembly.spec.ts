/**
 * E2E: Deal Assembly Flow
 *
 * Verifies the Deal Assembly workspace renders StakeholderMap and GapResolution
 * widgets, and that the Confirm & Proceed button is present.
 *
 * Requires: E2E_EMAIL, E2E_PASSWORD, E2E_TENANT_SLUG, E2E_CASE_ID env vars.
 * Tests are skipped when env vars are absent (CI without seed data).
 */

import { expect, test } from "@playwright/test";

const TENANT_SLUG = process.env.E2E_TENANT_SLUG;
const CASE_ID = process.env.E2E_CASE_ID;
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const hasEnv = !!(EMAIL && PASSWORD && TENANT_SLUG && CASE_ID);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', EMAIL!);
  await page.fill('input[type="password"]', PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.describe("Deal Assembly Workspace", () => {
  test("renders StakeholderMap and GapResolution widgets", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/assembly`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

    const stakeholderWidget = page
      .locator('[data-widget-id="stakeholder-map"], [id="stakeholder-map"]')
      .or(page.getByText("Stakeholders"));
    await expect(stakeholderWidget.first()).toBeVisible({ timeout: 15_000 });

    const gapWidget = page
      .locator('[data-widget-id="gap-resolution"], [id="gap-resolution"]')
      .or(page.getByText(/gap/i).first());
    await expect(gapWidget.first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows assembly progress bar", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/assembly`);
    await page.waitForLoadState("networkidle").catch(() => {});

    const progressBar = page.locator('[role="progressbar"], .h-2.bg-muted');
    await expect(progressBar.first()).toBeVisible({ timeout: 15_000 });
  });

  test("Confirm & Proceed button is present", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/assembly`);
    await page.waitForLoadState("networkidle").catch(() => {});

    const proceedBtn = page.getByRole("button", { name: /proceed/i });
    await expect(proceedBtn).toBeVisible({ timeout: 15_000 });
  });
});
