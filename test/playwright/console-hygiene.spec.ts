import { expect, test } from "@playwright/test";

test.describe("Console Hygiene & Security Headers", () => {
  const errors: string[] = [];
  const securityWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Collect console logs
    page.on("console", (msg) => {
      const text = msg.text();
      const type = msg.type();

      if (type === "error") {
        errors.push(text);
      }

      // Track security-related warnings
      if (
        type === "warning" &&
        (text.includes("Content Security Policy") ||
          text.includes("Sanitizer") ||
          text.includes("CORS") ||
          text.includes("ReferenceError"))
      ) {
        securityWarnings.push(text);
      }
    });

    page.on("pageerror", (err) => {
      errors.push(`Unhandled Exception: ${err.message}`);
    });
  });

  test("should boot up with zero console errors or security warnings", async ({
    page,
  }) => {
    // Go to home page
    await page.goto("/");

    // Wait for bootstrap to complete
    // We added data-testid="bootstrap-complete" to BootstrapGuard.tsx
    const bootstrapComplete = page.locator(
      '[data-testid="bootstrap-complete"]'
    );
    await expect(bootstrapComplete).toBeAttached({ timeout: 15000 });

    // Assertions
    expect(
      errors,
      `Expected zero console errors, but found: ${errors.join("\n")}`
    ).toHaveLength(0);
    expect(
      securityWarnings,
      `Expected zero security-related warnings, but found: ${securityWarnings.join("\n")}`
    ).toHaveLength(0);

    // Verify CSP meta tag exists (one of our fixes)
    const cspMeta = await page.locator(
      'meta[http-equiv="Content-Security-Policy"]'
    );
    await expect(cspMeta).toBeAttached();

    // Ensure frame-ancestors is NOT in the meta tag (it was causing a warning)
    const cspContent = await cspMeta.getAttribute("content");
    expect(cspContent).not.toContain("frame-ancestors");
  });

  test("should handle hard refresh and still maintain hygiene", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.locator('[data-testid="bootstrap-complete"]')
    ).toBeAttached();

    // Trigger hard refresh
    await page.reload({ waitUntil: "networkidle" });

    await expect(
      page.locator('[data-testid="bootstrap-complete"]')
    ).toBeAttached();
    expect(errors).toHaveLength(0);
  });
});
