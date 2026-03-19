import { expect, test } from "@playwright/test";

test.describe("main layout skip link", () => {
  test("first Tab reveals the skip link and activation focuses #main-content", async ({ page }) => {
    await page.setContent(`
      <a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>
      <button>Menu</button>
      <main id="main-content" tabindex="-1">Main content</main>
    `);

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});
