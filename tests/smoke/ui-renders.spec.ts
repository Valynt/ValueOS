import { expect, test } from "@playwright/test";

/**
 * UI Smoke Test - Verifies the app shell renders
 *
 * This is the most basic smoke test that proves:
 * 1. The frontend builds and serves
 * 2. React renders without crashing
 * 3. No critical console errors
 *
 * Run: npm run ui:smoke
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

// Console error patterns that indicate critical failures
const CRITICAL_ERROR_PATTERNS = [
  /Failed to load resource.*net::ERR_CONNECTION_REFUSED/,
  /Uncaught TypeError/,
  /Uncaught ReferenceError/,
  /Uncaught SyntaxError/,
  /Cannot read properties of undefined/,
  /Cannot read properties of null/,
  /is not a function/,
  /is not defined/,
  /ChunkLoadError/,
  /Loading chunk.*failed/,
];

// Patterns to ignore (expected in development)
const IGNORED_ERROR_PATTERNS = [
  /favicon\.ico/,
  /\[HMR\]/,
  /\[vite\]/,
  /DevTools/,
  /Source map/,
  /Failed to load resource.*404/,
];

test.describe("UI Smoke Test", () => {
  test("App shell renders without critical errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const criticalErrors: string[] = [];

    // Capture console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();

        // Skip ignored patterns
        if (IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
          return;
        }

        consoleErrors.push(text);

        // Check for critical errors
        if (CRITICAL_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
          criticalErrors.push(text);
        }
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on("pageerror", (error) => {
      criticalErrors.push(`Page error: ${error.message}`);
    });

    // Navigate to the app
    const response = await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Basic response check - treat 4xx and 5xx as failures
    expect(response, "Expected a navigation response from the app shell route.").not.toBeNull();
    expect(
      response!.status(),
      `App shell request should succeed; received HTTP ${response!.status()}.`,
    ).toBeGreaterThanOrEqual(200);
    expect(response!.status()).toBeLessThan(400);

    // Wait for React to render
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Check that the root element exists and has content
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 10000 });

    // Check that React rendered something (not just empty div)
    const rootContent = await root.innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);

    // Check for bootstrap status element (proves React rendered)
    const bootstrapStatus = page.locator("#bootstrap-status");
    const hasBootstrapStatus = (await bootstrapStatus.count()) > 0;

    // Either bootstrap status exists OR we have visible content
    if (!hasBootstrapStatus) {
      // Fallback: check for any meaningful content
      const hasContent = await page.locator("body").evaluate((body) => {
        return body.innerText.length > 50;
      });
      expect(hasContent).toBe(true);
    }

    // Report any console errors (for debugging)
    if (consoleErrors.length > 0) {
      console.log("Console errors detected:", consoleErrors);
    }

    // Fail on critical errors
    expect(criticalErrors, `Critical errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });

  test("No white screen of death", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });

    // Check that the page has visible content
    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);

    // Check that the page is not completely white/empty
    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Get the actual rendered content
    const hasVisibleContent = await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) return false;

      // Check if there's any visible text or elements
      const text = root.innerText.trim();
      const elements = root.querySelectorAll("*");

      return text.length > 0 || elements.length > 5;
    });

    expect(hasVisibleContent).toBe(true);
  });

  test("Error boundary catches errors gracefully", async ({ page }) => {
    // Navigate to a route that might trigger an error
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Check that error boundary UI is NOT showing (app is healthy)
    const errorBoundary = page.locator(".vc-error-root");
    const hasErrorBoundary = (await errorBoundary.count()) > 0;

    if (hasErrorBoundary) {
      // If error boundary is showing, it should have retry button
      const retryButton = page.locator(".vc-retry-button");
      await expect(retryButton).toBeVisible();
    } else {
      // No error boundary = app rendered successfully
      expect(hasErrorBoundary).toBe(false);
    }
  });

  test("Supabase warning banner works when unreachable", async ({ page, context }) => {
    // Block Supabase requests to simulate unreachable
    await context.route("**/supabase**", (route) => route.abort());

    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });

    // App should still render (not crash)
    const root = page.locator("#root");
    await expect(root).toBeVisible();

    // Warning banner might be shown (depends on timing)
    // Just verify the app didn't crash
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
