import { test, expect, Page } from "@playwright/test";

/**
 * Fuzzing Utility: Injects malformed SDUI schemas into the response stream.
 */
async function injectSDUIFuzz(page: Page, payload: object) {
  await page.route("/api/v1/sdui/render", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

test.describe("SDUI Fuzzing & Schema Resilience", () => {
  const garbagePayloads = [
    { type: "unknown_widget_123", props: {} },
    { type: "value_tree_card", props: { data: "This should be an array" } },
    { type: null, props: {} },
    { type: "value_tree_card", props: { labels: { $circular: true } } },
  ];

  for (const payload of garbagePayloads) {
    test(`Should handle garbage payload: ${JSON.stringify(payload).slice(0, 30)}...`, async ({
      page,
    }) => {
      await injectSDUIFuzz(page, payload);
      await page.goto("/agent/chat");

      // Verify that either the Error Boundary or the Fallback UI is displayed
      const fallbackUI = page.locator("text=Unsupported UI Element");
      const errorBoundaryUI = page.locator("text=Agent Interface Unavailable");

      await expect(fallbackUI.or(errorBoundaryUI)).toBeVisible();
    });
  }
});
