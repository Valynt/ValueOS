import { test, expect } from "@playwright/test";

test("executive output studio shell renders", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL required");
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/org/test/workspace/test/executive-output`);
  await expect(page).toHaveURL(/executive-output/);
});
