import { expect, test } from "@playwright/test";

test.describe("SDUI Visual Regression: Skeleton States", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a dedicated component preview route or mock the loading state
    // For now, assuming detailed component route or using a generic one that supports state queries
    // Adjust logic if specific route doesn't exist yet, potentially mocking network instead
    await page.goto("/debug/components/value-tree-card?state=loading");
  });

  test("ValueTreeCard skeleton should match baseline profile", async ({
    page,
  }) => {
    const skeleton = page.locator(".animate-pulse"); // Targeting the skeleton container

    // Ensure the skeleton is visible before snapshotting
    await expect(skeleton).toBeVisible();

    /**
     * Visual Regression Check:
     * Validates Header (40px), Body, and Footer (32px) proportions
     * defined in ValueTreeCardSkeleton.tsx
     */
    await expect(page).toHaveScreenshot("value-tree-card-loading.png", {
      maxDiffPixelRatio: 0.02, // Allow for minor anti-aliasing differences
      threshold: 0.2,
    });
  });
});
