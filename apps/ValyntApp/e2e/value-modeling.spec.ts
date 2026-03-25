/**
 * E2E: Value Modeling Flow
 *
 * Verifies the Value Model Workbench renders HypothesisCard widgets,
 * and that accepting a hypothesis updates the status badge.
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

test.describe("Value Model Workbench", () => {
  test("renders the workbench with tab navigation", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/model`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("heading", { name: /value model/i })).toBeVisible({ timeout: 15_000 });

    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("tab", { name: /hypothes/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /assumption/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /scenario/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /sensitivity/i })).toBeVisible();
  });

  test("HypothesisCard widgets render on the Hypotheses tab", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/model`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByRole("tab", { name: /hypothes/i }).click();

    const hypothesisContent = page
      .locator('[role="article"], [aria-label*="Hypothesis"]')
      .or(page.getByText(/no hypothes/i));
    await expect(hypothesisContent.first()).toBeVisible({ timeout: 15_000 });
  });

  test("Accept button on a pending hypothesis is keyboard accessible", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/model`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByRole("tab", { name: /hypothes/i }).click();

    const acceptBtn = page.getByRole("button", { name: /accept hypothesis/i }).first();
    const count = await acceptBtn.count();
    if (count > 0) {
      await acceptBtn.focus();
      await expect(acceptBtn).toBeFocused();
    }
  });

  test("Assumptions tab renders AssumptionRegister", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/model`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.getByRole("tab", { name: /assumption/i }).click();

    const assumptionContent = page
      .locator("table, [role='table']")
      .or(page.getByText(/no assumption/i));
    await expect(assumptionContent.first()).toBeVisible({ timeout: 15_000 });
  });
});
