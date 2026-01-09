/**
 * Accessibility Tests - axe-core Integration
 *
 * Automated accessibility testing using axe-core:
 * - WCAG 2.1 AA compliance
 * - Keyboard navigation
 * - Screen reader compatibility
 */

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Tests - WCAG 2.1 AA", () => {
  test("homepage should have no accessibility violations", async ({ page }) => {
    await page.goto("/");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("launch page should have no accessibility violations", async ({
    page,
  }) => {
    await page.goto("/launch");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("dashboard should have no accessibility violations", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("should support keyboard navigation", async ({ page }) => {
    await page.goto("/");

    // Tab through interactive elements
    await page.keyboard.press("Tab");

    // First focusable element should be focused
    const firstFocusable = page.locator(":focus").first();
    await expect(firstFocusable).toBeVisible();

    // Continue tabbing
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should be able to activate with Enter
    await page.keyboard.press("Enter");
  });

  test("forms should have proper labels", async ({ page }) => {
    await page.goto("/launch");

    // All inputs should have associated labels
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a"])
      .include("input, select, textarea")
      .analyze();

    const labelViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "label" || v.id === "label-title-only"
    );

    expect(labelViolations).toEqual([]);
  });

  test("images should have alt text", async ({ page }) => {
    await page.goto("/dashboard");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a"])
      .include("img")
      .analyze();

    const imgAltViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "image-alt"
    );

    expect(imgAltViolations).toEqual([]);
  });

  test("color contrast should meet WCAG AA", async ({ page }) => {
    await page.goto("/");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2aa"])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "color-contrast"
    );

    expect(contrastViolations).toEqual([]);
  });

  test("interactive elements should have accessible names", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a"])
      .include("button, a[href]")
      .analyze();

    const buttonNameViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "button-name" || v.id === "link-name"
    );

    expect(buttonNameViolations).toEqual([]);
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["best-practice"])
      .analyze();

    const headingViolations = accessibilityScanResults.violations.filter((v) =>
      v.id.includes("heading")
    );

    // Should have minimal heading violations
    expect(headingViolations.length).toBeLessThanOrEqual(2);
  });

  test("modals should trap focus", async ({ page }) => {
    await page.goto("/dashboard");

    // Open a modal (adjust selector as needed)
    await page.getByRole("button", { name: /settings|menu/i }).click();

    // Tab should stay within modal
    const modalBefore = page.locator('[role="dialog"]');
    await expect(modalBefore).toBeVisible();

    // Tab multiple times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }

    // Focus should still be within modal
    const focusedElement = page.locator(":focus");
    const modalAfter = page.locator('[role="dialog"]');

    await expect(modalAfter).toContainText(
      (await focusedElement.textContent()) || ""
    );
  });
});
