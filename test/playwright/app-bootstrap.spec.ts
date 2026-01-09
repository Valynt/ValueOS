import { expect, test } from "@playwright/test";

test.describe("App Bootstrap", () => {
  test("should load the app and pass the bootstrap guard", async ({ page }) => {
    // 1. Go to the home page
    await page.goto("/");

    // 2. Check for Loading Spinner (it should appear briefly)
    // We increase timeout just in case the initial load is slow
    const spinner = page.getByTestId("loading-spinner");

    // It might be too fast to catch, so we don't strictly assert it *must* be visible,
    // but we assert it eventually disappears.
    await expect(spinner).not.toBeVisible({ timeout: 15000 });

    // 3. Verify we are on the main screen (e.g., check for a known header or button)
    // Replace 'Error initializing application' with something that shouldn't be there
    await expect(page.locator("body")).not.toContainText(
      "Error initializing application"
    );

    // Check for main layout or login page depending on auth state
    // Since we are likely unauthenticated, we might end up at /login
    // Just ensuring we don't crash is a good first step.
    const hasMainLayout = await page
      .getByRole("main")
      .isVisible()
      .catch(() => false);
    const hasLoginForm = await page
      .getByRole("form")
      .isVisible()
      .catch(() => false);
    const hasContent = hasMainLayout || hasLoginForm;

    expect(hasContent).toBe(true);
  });
});
