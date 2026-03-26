import { test, expect } from "@playwright/test";

test("value modeling workbench shell renders", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL required");
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/org/test/workspace/test/model`);
  await expect(page).toHaveURL(/model/);
});
