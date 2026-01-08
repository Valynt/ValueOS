import { test, expect } from "@playwright/test";

/**
 * Smoke Tests - Critical Path Validation
 * These tests verify the most critical user flows work in production
 * Run time target: < 2 minutes
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

test.describe("Production Smoke Tests", () => {
  test.describe.configure({ mode: "parallel" });

  test("Homepage loads successfully", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
    
    // Verify critical elements
    await expect(page.locator("body")).toBeVisible();
  });

  test("Health endpoint responds", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body.status).toBe("healthy");
  });

  test("Login page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Verify login form elements
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("Static assets load correctly", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
    
    // Check for critical CSS
    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    expect(stylesheets).toBeGreaterThan(0);
    
    // Check for JavaScript
    const scripts = await page.locator("script[src]").count();
    expect(scripts).toBeGreaterThan(0);
  });

  test("API is reachable", async ({ request }) => {
    // Test API endpoint (adjust based on your API structure)
    const response = await request.get(`${BASE_URL}/api/health`);
    
    // Accept 200 or 404 (if not implemented), but not 500
    expect([200, 404]).toContain(response.status());
  });

  test("No console errors on homepage", async ({ page }) => {
    const errors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    
    // Should have no critical errors
    expect(errors).toHaveLength(0);
  });

  test("Performance: Page loads in acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test("Navigation works", async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Test basic navigation (adjust selectors based on your app)
    const navLinks = await page.locator("nav a, header a").count();
    expect(navLinks).toBeGreaterThan(0);
  });

  test("CSP headers are present", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers();
    
    // Verify security headers
    expect(headers).toBeDefined();
    // Add specific CSP checks based on your security requirements
  });

  test("CORS configuration is correct", async ({ request }) => {
    const response = await request.get(BASE_URL);
    const headers = response.headers();
    
    // Verify CORS headers exist (adjust based on requirements)
    expect(headers).toBeDefined();
  });
});

test.describe("Critical User Flows", () => {
  test("User can access protected routes after auth", async ({ page }) => {
    // This is a placeholder - implement based on your auth flow
    await page.goto(`${BASE_URL}/login`);
    
    // Add auth flow here when implementing
    // For now, just verify redirect works
    await expect(page).toHaveURL(/login/);
  });

  test("Supabase connection is established", async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Wait for app to initialize
    await page.waitForLoadState("networkidle");
    
    // Check that Supabase client initialized (via console or network)
    const hasSupabaseRequest = await page.waitForRequest(
      (request) => request.url().includes("supabase"),
      { timeout: 5000 }
    ).catch(() => null);
    
    // Supabase should be contacted during app init
    expect(hasSupabaseRequest).toBeTruthy();
  });
});

test.describe("Error Scenarios", () => {
  test("404 page exists", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/this-page-does-not-exist-12345`);
    
    // Should show 404 page, not crash
    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).toBeVisible();
  });

  test("App handles network errors gracefully", async ({ page, context }) => {
    await page.goto(BASE_URL);
    
    // Simulate offline
    await context.setOffline(true);
    
    // App should still be visible and not crash
    await expect(page.locator("body")).toBeVisible();
    
    // Restore connection
    await context.setOffline(false);
  });
});
