/**
 * Visual Regression Tests
 *
 * Playwright-based visual regression tests for key pages and states.
 * Uses screenshot comparison to detect unintended UI changes.
 */

import { test, expect } from "@playwright/test";

// Configure visual comparison options
const screenshotOptions = {
  fullPage: true,
  animations: "disabled" as const,
  mask: [], // Add selectors to mask dynamic content
};

test.describe("Visual Regression - Desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("login-desktop.png", screenshotOptions);
  });

  test("Signup page", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("signup-desktop.png", screenshotOptions);
  });

  test("Home dashboard - authenticated", async ({ page }) => {
    // Mock authentication
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem(
        "sb-auth-token",
        JSON.stringify({
          access_token: "mock-token",
          user: { id: "test-user", email: "test@example.com" },
        })
      );
    });

    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Mask dynamic content like timestamps
    await expect(page).toHaveScreenshot("home-dashboard-desktop.png", {
      ...screenshotOptions,
      mask: [page.locator("[data-testid='timestamp']")],
    });
  });

  test("Deals view", async ({ page }) => {
    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("deals-desktop.png", screenshotOptions);
  });

  test("Value Canvas", async ({ page }) => {
    await page.goto("/canvas");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("canvas-desktop.png", screenshotOptions);
  });

  test("Command Palette open", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Open command palette
    await page.keyboard.press("Meta+k");
    await page.waitForSelector("[role='dialog'][aria-label='Command palette']");

    await expect(page).toHaveScreenshot("command-palette-desktop.png", screenshotOptions);
  });

  test("404 Not Found", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("404-desktop.png", screenshotOptions);
  });
});

test.describe("Visual Regression - Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test("Login page - mobile", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("login-mobile.png", screenshotOptions);
  });

  test("Home dashboard - mobile", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("home-mobile.png", screenshotOptions);
  });

  test("Navigation menu - mobile", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Open mobile menu if exists
    const menuButton = page.locator("[data-testid='mobile-menu-button']");
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300); // Wait for animation
    }

    await expect(page).toHaveScreenshot("nav-menu-mobile.png", screenshotOptions);
  });
});

test.describe("Visual Regression - Component States", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Empty state - no sessions", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Check for empty state component
    const emptyState = page.locator("[data-testid='empty-state']");
    if (await emptyState.isVisible()) {
      await expect(emptyState).toHaveScreenshot("empty-state-sessions.png");
    }
  });

  test("Loading state", async ({ page }) => {
    // Intercept API calls to show loading state
    await page.route("**/api/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.continue();
    });

    await page.goto("/deals");

    // Capture loading state before data loads
    await expect(page).toHaveScreenshot("loading-state.png", screenshotOptions);
  });

  test("Error state", async ({ page }) => {
    // Mock API error
    await page.route("**/api/**", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await page.goto("/deals");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("error-state.png", screenshotOptions);
  });

  test("Mode selector variants", async ({ page }) => {
    await page.goto("/home");
    await page.waitForLoadState("networkidle");

    // Builder mode (default)
    await expect(page.locator("[data-testid='mode-selector']")).toHaveScreenshot(
      "mode-selector-builder.png"
    );

    // Switch to Presenter mode
    await page.click("[data-testid='mode-presenter']");
    await expect(page.locator("[data-testid='mode-selector']")).toHaveScreenshot(
      "mode-selector-presenter.png"
    );

    // Switch to Tracker mode
    await page.click("[data-testid='mode-tracker']");
    await expect(page.locator("[data-testid='mode-selector']")).toHaveScreenshot(
      "mode-selector-tracker.png"
    );
  });
});

test.describe("Visual Regression - Dark/Light Theme", () => {
  test("Dark theme - home", async ({ page }) => {
    await page.goto("/home");
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("home-dark-theme.png", screenshotOptions);
  });

  test("Light theme - home", async ({ page }) => {
    await page.goto("/home");
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("home-light-theme.png", screenshotOptions);
  });
});

function pseudoLocalizeText(text: string): string {
  const map: Record<string, string> = {
    a: "à", e: "ë", i: "ï", o: "ô", u: "ü", A: "Â", E: "Ë", I: "Ï", O: "Ö", U: "Û",
  };
  const accented = text
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
  return `[!! ${accented}${"~".repeat(Math.max(4, Math.ceil(text.length * 0.35)))} !!]`;
}

test.describe("Visual Regression - Localization Overflow", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  async function applyPseudoLocalization(page: import("@playwright/test").Page) {
    await page.evaluate(({ pseudoLocalizeTextSource }) => {
      const pseudoFn = new Function(`return (${pseudoLocalizeTextSource});`)() as (text: string) => string;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];

      let current = walker.nextNode();
      while (current) {
        const textNode = current as Text;
        const value = textNode.nodeValue?.trim();
        if (value) textNodes.push(textNode);
        current = walker.nextNode();
      }

      for (const node of textNodes) {
        if (!node.nodeValue) continue;
        node.nodeValue = pseudoFn(node.nodeValue);
      }
    }, { pseudoLocalizeTextSource: pseudoLocalizeText.toString() });
  }

  for (const workflow of [
    { name: "login", path: "/login" },
    { name: "home", path: "/home" },
    { name: "deals", path: "/deals" },
  ]) {
    test(`${workflow.name} - pseudo-locale has no horizontal overflow`, async ({ page }) => {
      await page.goto(workflow.path);
      await page.waitForLoadState("networkidle");
      await applyPseudoLocalization(page);

      const overflows = await page.evaluate(() => {
        const candidates = [document.documentElement, document.body, ...Array.from(document.querySelectorAll("main, section, article, [role='main']"))];
        return candidates
          .map((el) => ({
            tag: el.tagName,
            className: el.className,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          }))
          .filter((entry) => entry.scrollWidth - entry.clientWidth > 1);
      });

      expect(overflows, `Overflow detected in ${workflow.name}: ${JSON.stringify(overflows)}`).toEqual([]);
      await expect(page).toHaveScreenshot(`pseudo-loc-${workflow.name}-desktop.png`, screenshotOptions);
    });
  }
});
