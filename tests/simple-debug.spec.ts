import { expect, test } from "@playwright/test";

test.describe("Simple Frontend Debug", () => {
  test("check page load", async ({ page }) => {
    // Enable console logging
    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Enable network logging for failures
    const failedRequests: any[] = [];
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure(),
      });
      console.error(`[FAILED REQUEST] ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Navigate to the app
    console.log("Navigating to http://localhost:5173/");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Wait for React to mount
    await page.waitForSelector("#root > *", { timeout: 10000 }).catch(() => {
      console.log("Root element not found with children, checking for root itself");
    });

    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Take screenshot
    await page.screenshot({ path: "debug-page-load.png", fullPage: true });
    console.log("Screenshot saved to debug-page-load.png");

    // Check for any visible error messages
    const errorElements = await page.locator(".error, .error-message, [data-error]").count();
    if (errorElements > 0) {
      console.log(`Found ${errorElements} error elements`);
      for (let i = 0; i < errorElements; i++) {
        const errorText = await page
          .locator(".error, .error-message, [data-error]")
          .nth(i)
          .textContent();
        console.log(`Error ${i + 1}: ${errorText}`);
      }
    }

    // Log summary
    console.log("\n=== DEBUG SUMMARY ===");
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);

    if (failedRequests.length > 0) {
      console.log("\nFailed requests:");
      failedRequests.forEach((req) => {
        console.log(`  - ${req.url}: ${req.failure?.errorText}`);
      });
    }
  });

  test("check WebSocket connections", async ({ page }) => {
    const wsConnections: string[] = [];

    page.on("websocket", (ws) => {
      console.log(`WebSocket connecting to: ${ws.url()}`);
      wsConnections.push(ws.url());

      ws.on("close", () => {
        console.log(`WebSocket closed: ${ws.url()}`);
      });

      ws.on("socketerror", (error) => {
        console.error(`WebSocket error: ${error}`);
      });
    });

    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Wait for potential WebSocket connections
    await page.waitForTimeout(3000);

    console.log(`WebSocket connections: ${wsConnections.length}`);
    wsConnections.forEach((url) => console.log(`  - ${url}`));
  });

  test("check lucide-react icon", async ({ page }) => {
    const response = await page.goto(
      "http://localhost:5173/@fs/home/ino/ValueOS/node_modules/lucide-react/dist/esm/icons/fingerprint.js"
    );

    if (response && response.status() === 200) {
      console.log("✅ Fingerprint icon loaded successfully");
    } else {
      console.log(`❌ Failed to load fingerprint icon: ${response?.status()}`);

      // Try to get response headers
      if (response) {
        const headers = await response.allHeaders();
        console.log("Response headers:", headers);
      }
    }
  });

  test("check browser console errors", async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
        console.error(`ERROR: ${msg.text()}`);
      } else if (msg.type() === "warning") {
        warnings.push(msg.text());
        console.warn(`WARNING: ${msg.text()}`);
      }
    });

    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(`PAGE ERROR: ${error.message}`);
    });

    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Wait for any async errors
    await page.waitForTimeout(5000);

    console.log(`\nConsole errors: ${errors.length}`);
    errors.forEach((error) => console.log(`  ${error}`));

    console.log(`Console warnings: ${warnings.length}`);
    warnings.forEach((warning) => console.log(`  ${warning}`));
  });
});
