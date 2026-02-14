import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

type RouteBudgetConfig = {
  routeLoadMs: Record<string, number>;
};

const budgetPath = resolve(process.cwd(), ".github/metrics/ux-performance-budgets.json");
const outputPath = resolve(process.cwd(), "artifacts/performance/route-load-metrics.json");
const budgetConfig = JSON.parse(readFileSync(budgetPath, "utf-8")) as RouteBudgetConfig;
const routeBudgetEntries = Object.entries(budgetConfig.routeLoadMs ?? {});
const routeResults: Array<{ route: string; loadTimeMs: number; budgetMs: number }> = [];

for (const [route, budgetMs] of routeBudgetEntries) {
  test(`route ${route} loads within ${budgetMs}ms`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.ok() ?? true).toBeTruthy();

    const loadTimeMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return 0;
      const value = nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.domContentLoadedEventEnd;
      return Math.round(value);
    });

    routeResults.push({ route, loadTimeMs, budgetMs });
    expect(loadTimeMs).toBeLessThanOrEqual(budgetMs);
  });
}

test.afterAll(async () => {
  mkdirSync(resolve(process.cwd(), "artifacts/performance"), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), routes: routeResults }, null, 2)}\n`,
    "utf-8",
  );
});
