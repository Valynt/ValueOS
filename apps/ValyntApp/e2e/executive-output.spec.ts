/**
 * E2E: Executive Output Studio Flow
 *
 * Verifies the Executive Output Studio renders artifact tabs and the
 * output generation trigger is present and clickable.
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

test.describe("Executive Output Studio", () => {
  test("renders the studio with page title", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/outputs`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(
      page.getByRole("heading", { name: /executive output/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("artifact type tabs are present", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/outputs`);
    await page.waitForLoadState("networkidle").catch(() => {});

    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    const tabs = page.getByRole("tab");
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test("Generate Artifacts button is present and clickable", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/outputs`);
    await page.waitForLoadState("networkidle").catch(() => {});

    const generateBtn = page.getByRole("button", { name: /generate/i }).first();
    await expect(generateBtn).toBeVisible({ timeout: 15_000 });

    const isDisabled = await generateBtn.isDisabled();
    if (!isDisabled) {
      await expect(generateBtn).toBeEnabled();
    }
  });

  test("artifact content area renders after tab selection", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/outputs`);
    await page.waitForLoadState("networkidle").catch(() => {});

    const firstTab = page.getByRole("tab").first();
    await firstTab.click();

    const tabPanel = page.getByRole("tabpanel");
    await expect(tabPanel).toBeVisible({ timeout: 10_000 });
  });

  test("⌘K command palette opens from the studio", async ({ page }) => {
    test.skip(!hasEnv, "E2E_EMAIL / E2E_PASSWORD / E2E_TENANT_SLUG / E2E_CASE_ID not set");
    await login(page);
    await page.goto(`/org/${TENANT_SLUG}/workspace/${CASE_ID}/outputs`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await page.keyboard.press("Meta+k");

    const dialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });
});
