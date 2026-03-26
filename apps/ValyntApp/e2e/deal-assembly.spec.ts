import { test, expect } from "@playwright/test";

test("deal assembly workspace shell renders", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL required");
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/org/test/workspace/test/assembly`);
  await expect(page).toHaveURL(/assembly/);
});
