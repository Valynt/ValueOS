import { test, expect } from "@playwright/test";

test.describe("Scalekit Authentication Flow - End to End", () => {
  test.beforeEach(async ({ page }) => {
    // Enable detailed logging
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (error) => console.log("PAGE ERROR:", error));
  });

  test("should complete full Scalekit authentication flow", async ({
    page,
  }) => {
    // Step 1: Navigate to the login page
    console.log("Step 1: Navigating to login page...");
    await page.goto("http://localhost:5173/a/auth/login");

    // Wait for the page to load
    await expect(page.getByText("Enterprise Access")).toBeVisible({
      timeout: 10000,
    });

    console.log("Step 2: Waiting for redirect to Scalekit...");

    // The page should automatically redirect to Scalekit
    // Wait for the URL to contain scalekit.dev
    await page.waitForURL(/.*scalekit\.dev.*/, { timeout: 15000 });

    const scalekitUrl = page.url();
    console.log("Step 3: Redirected to Scalekit:", scalekitUrl);

    // Verify the URL has correct parameters
    expect(scalekitUrl).toContain("client_id=");
    expect(scalekitUrl).toContain("redirect_uri=");
    expect(scalekitUrl).toContain("response_type=code");

    // Extract and log the redirect_uri parameter
    const url = new URL(scalekitUrl);
    const redirectUri = url.searchParams.get("redirect_uri");
    console.log("Redirect URI:", redirectUri);

    // Verify redirect_uri points to our backend
    expect(redirectUri).toContain("/api/auth/callback");

    // Step 4: Fill in authentication (if there's a form)
    // Note: This might require actual credentials or a test account
    console.log("Step 4: Looking for authentication form...");

    // Check if there's an email input
    const emailInput = page.locator('input[type="email"]');
    const hasEmailInput = await emailInput.count();

    if (hasEmailInput > 0) {
      console.log("Found email input, filling in test email...");
      await emailInput.fill("test@example.com");

      // Look for submit button
      const submitButton = page.locator('button[type="submit"]');
      if ((await submitButton.count()) > 0) {
        console.log("Clicking submit button...");
        await submitButton.click();

        // Wait for magic link or OTP prompt
        console.log("Waiting for OTP or magic link prompt...");
        await page.waitForTimeout(2000);
      }
    }

    console.log("Current URL after form:", page.url());
  });

  test("should verify backend callback endpoint is accessible", async ({
    request,
  }) => {
    console.log("Testing backend callback endpoint...");

    // Test that the callback endpoint exists and returns appropriate response
    const response = await request.get(
      "http://localhost:3000/api/auth/callback"
    );

    console.log("Callback endpoint status:", response.status());
    console.log("Callback endpoint headers:", await response.allHeaders());

    // Should redirect without code parameter
    expect([302, 400]).toContain(response.status());
  });

  test("should verify authorize endpoint returns correct URL", async ({
    request,
  }) => {
    console.log("Testing authorize endpoint...");

    const response = await request.get(
      "http://localhost:3000/api/auth/authorize"
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    console.log("Authorization URL:", data.url);

    // Verify the URL structure
    expect(data.url).toContain("valynt.scalekit.dev/oauth/authorize");
    expect(data.url).toContain("client_id=");
    expect(data.url).toContain("redirect_uri=");

    // Extract redirect_uri from the URL
    const authUrl = new URL(data.url);
    const redirectUri = authUrl.searchParams.get("redirect_uri");
    console.log("Configured redirect_uri:", redirectUri);

    // This is the critical check - verify it matches backend config
    expect(redirectUri).toBe("http://localhost:3000/api/auth/callback");
  });

  test("should handle callback with mock code", async ({ request }) => {
    console.log("Testing callback with mock code...");

    // This will fail authentication but should not crash
    const response = await request.get(
      "http://localhost:3000/api/auth/callback?code=mock_test_code"
    );

    console.log("Mock callback status:", response.status());

    // Should redirect to login with error
    expect([302, 500]).toContain(response.status());

    if (response.status() === 302) {
      const location = response.headers()["location"];
      console.log("Redirect location:", location);
      expect(location).toContain("/login");
    }
  });

  test("should verify environment configuration", async ({ page }) => {
    console.log("Checking frontend environment variables...");

    await page.goto("http://localhost:5173");

    // Execute JavaScript to check window env vars
    const appUrl = await page.evaluate(() => {
      return (window as any).VITE_APP_URL || import.meta.env.VITE_APP_URL;
    });

    console.log("Frontend VITE_APP_URL:", appUrl);

    // Should be localhost in development
    expect(appUrl).toContain("localhost");
  });
});

test.describe("Scalekit Configuration Validation", () => {
  test("should have correct redirect URI configured", async ({ request }) => {
    const response = await request.get(
      "http://localhost:3000/api/auth/authorize"
    );
    const data = await response.json();

    const authUrl = new URL(data.url);
    const redirectUri = authUrl.searchParams.get("redirect_uri");

    // Document the expected vs actual
    console.log("\n=== SCALEKIT CONFIGURATION ===");
    console.log("Expected redirect_uri: http://localhost:3000/api/auth/callback");
    console.log("Actual redirect_uri:", redirectUri);
    console.log(
      "Match:",
      redirectUri === "http://localhost:3000/api/auth/callback" ? "✅" : "❌"
    );
    console.log("================================\n");

    expect(redirectUri).toBe("http://localhost:3000/api/auth/callback");
  });

  test("should verify Scalekit environment URL", async ({ request }) => {
    const response = await request.get(
      "http://localhost:3000/api/auth/authorize"
    );
    const data = await response.json();

    console.log("\n=== SCALEKIT ENVIRONMENT ===");
    console.log("Authorization URL:", data.url);

    // Should use valynt.scalekit.dev as the environment
    expect(data.url).toContain("https://valynt.scalekit.dev/oauth/authorize");
    console.log("Environment:", "valynt.scalekit.dev ✅");
    console.log("============================\n");
  });
});
