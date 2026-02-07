/**
 * Playwright Login Test Script with Network Debugging
 */

import { chromium } from "playwright";

async function testLogin() {
  console.log("🎭 Starting Playwright login test with network debugging...\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  const consoleMessages = [];
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  // Capture network requests
  const networkRequests = [];
  page.on("request", (request) => {
    if (
      request.url().includes("supabase") ||
      request.url().includes("auth") ||
      request.url().includes("54321")
    ) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    }
  });

  // Capture network responses
  const networkResponses = [];
  page.on("response", async (response) => {
    if (
      response.url().includes("supabase") ||
      response.url().includes("auth") ||
      response.url().includes("54321")
    ) {
      let body = null;
      try {
        body = await response.text();
      } catch (e) {
        body = "<unable to read body>";
      }
      networkResponses.push({
        url: response.url(),
        status: response.status(),
        body: body.substring(0, 500),
      });
    }
  });

  try {
    // Navigate to login page
    console.log("📍 Navigating to login page...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Find and fill email field
    console.log("📝 Filling in credentials...");
    const emailInput = page
      .locator('input[type="email"], input[name="email"], input[placeholder*="email"]')
      .first();
    await emailInput.fill("demouser@valynt.com");

    // Find and fill password field
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("passord");

    // Click submit button
    console.log("🔐 Submitting login form...");
    const submitButton = page
      .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
      .first();
    await submitButton.click();

    // Wait for network activity
    console.log("⏳ Waiting for auth request...");
    await page.waitForTimeout(5000);

    // Print network activity
    console.log("\n📡 Network Requests (auth-related):");
    networkRequests.forEach((req, i) => {
      console.log(`   [${i + 1}] ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`       POST data: ${req.postData.substring(0, 200)}`);
      }
    });

    console.log("\n📡 Network Responses (auth-related):");
    networkResponses.forEach((res, i) => {
      console.log(`   [${i + 1}] ${res.status} ${res.url}`);
      console.log(`       Body: ${res.body.substring(0, 200)}`);
    });

    // Print console errors
    const errors = consoleMessages.filter((m) => m.type === "error");
    if (errors.length > 0) {
      console.log("\n🔴 Console Errors:");
      errors.forEach((err) => {
        console.log(`   ${err.text}`);
      });
    }

    // Check final state
    const currentUrl = page.url();
    console.log(`\n📍 Final URL: ${currentUrl}`);

    // Take final screenshot
    await page.screenshot({ path: "/workspaces/ValueOS/test-results/login-debug.png" });
    console.log("📸 Screenshot saved: login-debug.png");

    if (!currentUrl.includes("/login")) {
      console.log("\n✅ LOGIN SUCCESSFUL!");
    } else {
      console.log("\n⚠️  Still on login page after submit");

      // Check for visible error messages on page
      const errorElements = await page
        .locator('.error, [role="alert"], .text-red-500, .text-destructive')
        .all();
      for (const el of errorElements) {
        const text = await el.textContent().catch(() => "");
        if (text) {
          console.log(`   Page error: ${text}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
    await page.screenshot({ path: "/workspaces/ValueOS/test-results/login-error.png" });
  } finally {
    await browser.close();
  }
}

testLogin().catch(console.error);
