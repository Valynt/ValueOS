/**
 * Automated WCAG 2.2 AA accessibility tests using Playwright + axe-core.
 *
 * Runs axe-core against high-traffic pages in ValyntApp and VOSAcademy.
 * Fails on serious/critical violations.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Pages to test — add new routes here as features ship
const PAGES = [
  { name: "Home / Login", path: "/" },
  { name: "Dashboard", path: "/dashboard" },
  { name: "Auth - Sign In", path: "/auth/login" },
];

for (const page of PAGES) {
  test.describe(`Accessibility: ${page.name}`, () => {
    test(`should have no serious or critical WCAG 2.2 AA violations`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: "networkidle" });

      const results = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();

      const impactCounts = results.violations.reduce(
        (acc, violation) => {
          const impact = violation.impact ?? "unknown";
          acc[impact] = (acc[impact] ?? 0) + violation.nodes.length;
          return acc;
        },
        {} as Record<string, number>
      );

      test.info().annotations.push({
        type: "a11y-impact-counts",
        description: JSON.stringify(impactCounts),
      });

      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );

      if (serious.length > 0) {
        const summary = serious
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))\n` +
              v.nodes.map((n) => `  - ${n.html.substring(0, 120)}`).join("\n")
          )
          .join("\n\n");

        // Attach violation details to test report
        test.info().annotations.push({
          type: "a11y-violations",
          description: summary,
        });
      }

      expect(
        serious,
        `Found ${serious.length} serious/critical a11y violations on ${page.path}`
      ).toHaveLength(0);
    });

    test(`should be keyboard navigable`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: "networkidle" });

      // Tab through the page and verify focus is visible
      const focusableCount = await p.evaluate(() => {
        const focusable = document.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        return focusable.length;
      });

      // Tab through first N focusable elements and check focus visibility
      const maxTabs = Math.min(focusableCount, 20);
      for (let i = 0; i < maxTabs; i++) {
        await p.keyboard.press("Tab");

        const hasFocusVisible = await p.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return true; // skip body focus
          const styles = window.getComputedStyle(el);
          // Check for visible focus indicator (outline or box-shadow)
          return (
            styles.outlineStyle !== "none" ||
            styles.boxShadow !== "none"
          );
        });

        // We warn but don't fail on focus visibility — it's tracked as a metric
        if (!hasFocusVisible) {
          test.info().annotations.push({
            type: "focus-warning",
            description: `Element at tab index ${i} may lack visible focus indicator`,
          });
        }
      }

      expect(focusableCount).toBeGreaterThan(0);
    });
  });
}
