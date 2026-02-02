import { test, expect } from "@playwright/test";

test("login flow", async ({ page }) => {
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  // Go to login page
  await page.goto("/login");

  // Fill credentials
  await page.fill("#email", "demouser2@valynt.com");
  await page.fill("#password", "passw0rd!");

  // Click submit
  await page.click('button[type="submit"]');

  // Wait for login processing and redirect
  // The login calls Supabase (network request) so we wait for that
  // We can also wait for the URL to change from /login
  try {
    await expect(page).toHaveURL(/^(?!.*\/login).*/, { timeout: 10000 });
  } catch (e) {
    // If it fails, take screenshot/content for debugging
    console.log("Current URL:", page.url());
    console.log("Login failed or timed out");
    // Check for error message
    const error = await page.textContent(".border-red-500\\/20");
    if (error) console.log("Error message:", error);
    throw e;
  }
});
