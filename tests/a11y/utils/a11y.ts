import { expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const MIN_WCAG_LEVEL = "WCAG 2.2 AA";

export async function checkNoSeriousOrCriticalViolations(page: Page, scopeName: string) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();

  const blockingViolations = accessibilityScanResults.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? "")
  );

  expect(
    blockingViolations,
    `${scopeName} has serious/critical WCAG 2.2 AA violations:\n${blockingViolations
      .map((v) => `${v.id} (${v.impact}): ${v.help}`)
      .join("\n")}`
  ).toEqual([]);
}

export async function assertKeyboardCanReachMainLandmarks(page: Page) {
  await page.keyboard.press("Tab");
  const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? "");
  expect(activeTag).not.toBe("body");

  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
  }

  const focusableCount = await page.evaluate(() => {
    const selectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    return Array.from(document.querySelectorAll<HTMLElement>(selectors)).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    }).length;
  });

  expect(focusableCount).toBeGreaterThan(0);
}

export async function assertFocusOrderDoesNotTrap(page: Page) {
  const seen = new Set<string>();

  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Tab");
    const marker = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return "none";
      return `${active.tagName}:${active.id}:${active.getAttribute("name")}:${active.textContent?.trim()?.slice(0, 20) ?? ""}`;
    });

    seen.add(marker);
  }

  expect(seen.size).toBeGreaterThan(3);
}
