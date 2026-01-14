import { test, expect, chromium } from "@playwright/test";

test.describe("Frontend Debug Tests", () => {
  let browser;
  let context;
  let page;

  test.beforeAll(async () => {
    // Launch browser with additional debugging options
    browser = await chromium.launch({
      headless: false, // Show browser for debugging
      slowMo: 500, // Slow down actions
      args: [
        "--disable-web-security", // Allow mixed content
        "--disable-features=VizDisplayCompositor",
        "--ignore-certificate-errors",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      permissions: ["clipboard-read", "clipboard-write"],
    });

    page = await context.newPage();

    // Enable console logging
    page.on("console", (msg) => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });

    // Enable network logging
    page.on("request", (request) => {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
    });

    page.on("response", (response) => {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    });

    // Enable error logging
    page.on("pageerror", (error) => {
      console.error(`[PAGE ERROR] ${error.message}`);
      console.error(error.stack);
    });
  });

  test.afterAll(async () => {
    await context.close();
    await browser.close();
  });

  test("check page load and resources", async () => {
    // Navigate to the app
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Check if page loaded
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });

    // Check for any error messages
    const errorElements = await page.locator('[role="alert"], .error, .error-message').count();
    if (errorElements > 0) {
      console.log(`Found ${errorElements} error elements on page`);
      for (let i = 0; i < errorElements; i++) {
        const errorText = await page
          .locator('[role="alert"], .error, .error-message')
          .nth(i)
          .textContent();
        console.log(`Error ${i + 1}: ${errorText}`);
      }
    }

    // Take screenshot for visual inspection
    await page.screenshot({ path: "debug-screenshot.png", fullPage: true });
    console.log("Screenshot saved to debug-screenshot.png");
  });

  test("check WebSocket connections", async () => {
    // Monitor WebSocket connections
    const wsConnections = [];

    page.on("websocket", (ws) => {
      console.log(`[WEBSOCKET] Connecting to: ${ws.url()}`);
      wsConnections.push(ws.url());

      ws.on("framereceived", (event) => {
        console.log(`[WS RECEIVED] ${event.payload}`);
      });

      ws.on("framesent", (event) => {
        console.log(`[WS SENT] ${event.payload}`);
      });

      ws.on("close", () => {
        console.log(`[WS CLOSED] ${ws.url()}`);
      });

      ws.on("error", (error) => {
        console.error(`[WS ERROR] ${error.message}`);
      });
    });

    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Wait a bit for WebSocket connections
    await page.waitForTimeout(3000);

    console.log(`WebSocket connections attempted: ${wsConnections.length}`);
    wsConnections.forEach((url) => console.log(`  - ${url}`));
  });

  test("check resource loading", async () => {
    const failedResources = [];

    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResources.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });

    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    if (failedResources.length > 0) {
      console.log("Failed resources:");
      failedResources.forEach((resource) => {
        console.log(`  [${resource.status}] ${resource.url} - ${resource.statusText}`);
      });
    } else {
      console.log("All resources loaded successfully");
    }
  });

  test("check lucide-react icon loading", async () => {
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Try to load the fingerprint icon directly
    const iconResponse = await page.goto(
      "http://localhost:5173/@fs/home/ino/ValueOS/node_modules/lucide-react/dist/esm/icons/fingerprint.js"
    );

    if (iconResponse && iconResponse.status() === 200) {
      console.log("✅ Fingerprint icon loaded successfully");
    } else {
      console.log(`❌ Failed to load fingerprint icon: ${iconResponse?.status()}`);
    }
  });

  test("check browser console for errors", async () => {
    const consoleErrors = [];
    const consoleWarnings = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      } else if (msg.type() === "warning") {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Wait for any async errors
    await page.waitForTimeout(5000);

    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach((error) => console.log(`  ERROR: ${error}`));

    console.log(`Console warnings: ${consoleWarnings.length}`);
    consoleWarnings.forEach((warning) => console.log(`  WARNING: ${warning}`));
  });

  test("check application bootstrap", async () => {
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });

    // Wait for React to mount
    await page.waitForSelector("#root > *", { timeout: 10000 });

    // Check if BootstrapGuard is rendered
    const bootstrapGuard = await page
      .locator('[data-testid="bootstrap-guard"], .bootstrap-guard')
      .count();
    console.log(`BootstrapGuard elements found: ${bootstrapGuard}`);

    // Check for loading states
    const loadingElements = await page.locator('.loading, .spinner, [data-loading="true"]').count();
    console.log(`Loading elements found: ${loadingElements}`);

    // Check for error states
    const errorElements = await page.locator(".error, .error-message, [data-error]").count();
    console.log(`Error elements found: ${errorElements}`);

    // Wait for potential bootstrap completion
    await page.waitForTimeout(5000);

    // Get page HTML for inspection
    const html = await page.content();
    console.log("Page HTML length:", html.length);

    // Save HTML for manual inspection
    await page.evaluate(() => {
      document.body.style.backgroundColor = "white";
    });
    await page.screenshot({ path: "bootstrap-debug.png", fullPage: true });
    console.log("Bootstrap screenshot saved to bootstrap-debug.png");
  });
});
