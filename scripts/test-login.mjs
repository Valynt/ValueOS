/**
 * Playwright Login Test Script
 * Tests the login flow using the demo credentials
 */

import { chromium } from "playwright";

async function testLogin() {
  console.log("🎭 Starting Playwright login test...\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log("📍 Navigating to login page...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Take screenshot before login
    await page.screenshot({ path: "/workspaces/ValueOS/test-results/login-before.png" });
    console.log("📸 Screenshot saved: login-before.png");

    // Find and fill email field
    console.log("📝 Filling in credentials...");
    const emailInput = page
      .locator('input[type="email"], input[name="email"], input[placeholder*="email"]')
      .first();
    await emailInput.fill("demouser@valynt.com");

    // Find and fill password field
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("passord");

    // Take screenshot with filled form
    await page.screenshot({ path: "/workspaces/ValueOS/test-results/login-filled.png" });
    console.log("📸 Screenshot saved: login-filled.png");

    // Click submit button
    console.log("🔐 Submitting login form...");
    const submitButton = page
      .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
      .first();
    await submitButton.click();

    // Wait for navigation or response
    console.log("⏳ Waiting for response...");
    await page.waitForTimeout(5000);

    // Get page content to check for errors
    const pageContent = await page.content();

    // Check for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`   Console error: ${msg.text()}`);
      }
    });

    // Check for successful login indicators
    const currentUrl = page.url();
    console.log(`📍 Current URL after login: ${currentUrl}`);

    // Take screenshot after login attempt
    await page.screenshot({ path: "/workspaces/ValueOS/test-results/login-after.png" });
    console.log("📸 Screenshot saved: login-after.png");

    // Check if we're redirected away from login page
    if (!currentUrl.includes("/login")) {
      console.log("\n✅ LOGIN SUCCESSFUL!");
      console.log(`   Redirected to: ${currentUrl}`);

      // Try to get user info from page
      const pageContent = await page.content();
      if (pageContent.includes("demouser") || pageContent.includes("valynt.com")) {
        console.log("   User info visible on page");
      }
    } else {
      // Check for error messages
      const errorText = await page
        .locator('.error, [role="alert"], .text-red-500')
        .textContent()
        .catch(() => null);
      if (errorText) {
        console.log(`\n⚠️  Login may have failed. Error: ${errorText}`);
      } else {
        console.log("\n⚠️  Still on login page - checking for success indicators...");
      }
    }

    // Print final result
    console.log("\n📊 Test Results:");
    console.log(`   Email: demouser@valynt.com`);
    console.log(`   Password: passord`);
    console.log(`   Final URL: ${currentUrl}`);
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    await page.screenshot({ path: "/workspaces/ValueOS/test-results/login-error.png" });
  } finally {
    await browser.close();
    console.log("\n🎭 Playwright test complete.");
  }
}

testLogin();
