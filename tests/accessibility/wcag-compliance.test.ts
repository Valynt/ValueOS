import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AccessibilityRoute = {
  name: string;
  path: string;
  requiredLandmarks: Array<"main" | "form" | "navigation">;
  keyboardFlow: "auth-form" | "skip-link";
};

const ROUTES: AccessibilityRoute[] = [
  {
    name: "Login",
    path: "/login",
    requiredLandmarks: ["form"],
    keyboardFlow: "auth-form",
  },
  {
    name: "Signup",
    path: "/signup",
    requiredLandmarks: ["form"],
    keyboardFlow: "auth-form",
  },
  {
    name: "Reset password",
    path: "/reset-password",
    requiredLandmarks: ["form"],
    keyboardFlow: "auth-form",
  },
  {
    name: "Main layout harness",
    path: "/__playwright__/main-layout",
    requiredLandmarks: ["main", "navigation"],
    keyboardFlow: "skip-link",
  },
];

function addRuntimeEvidenceAnnotation(check: string, route: string) {
  test.info().annotations.push({
    type: "a11y-evidence",
    description: `runtime-executable:${check}:${route}`,
  });
}

for (const route of ROUTES) {
  test.describe(`WCAG runtime validation: ${route.name}`, () => {
    test("runs axe-core WCAG 2.2 AA scan against live route", async ({ page }) => {
      addRuntimeEvidenceAnnotation("axe", route.path);
      await page.goto(route.path, { waitUntil: "networkidle" });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();

      const blockerImpacts = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );

      if (blockerImpacts.length > 0) {
        test.info().annotations.push({
          type: "a11y-violations",
          description: blockerImpacts
            .map((violation) => `[${violation.impact ?? "unknown"}] ${violation.id}`)
            .join("\n"),
        });
      }

      expect(
        blockerImpacts,
        `${route.path} contains serious/critical WCAG 2.2 AA violations`,
      ).toHaveLength(0);
    });

    test("asserts landmarks and keyboard semantics from rendered DOM", async ({ page }) => {
      addRuntimeEvidenceAnnotation("keyboard-and-landmarks", route.path);
      await page.goto(route.path, { waitUntil: "networkidle" });

      if (route.requiredLandmarks.includes("main")) {
        await expect(page.getByRole("main").first()).toBeVisible();
      }

      if (route.requiredLandmarks.includes("form")) {
        await expect(page.locator("form").first()).toBeVisible();
      }

      if (route.requiredLandmarks.includes("navigation")) {
        await expect(page.getByRole("navigation").first()).toBeVisible();
      }

      if (route.keyboardFlow === "auth-form") {
        await page.keyboard.press("Tab");

        const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
        expect(["input", "button", "a", "select", "textarea"]).toContain(activeTag ?? "");

        await expect(page.getByLabel(/email/i).first()).toBeVisible();
      }

      if (route.keyboardFlow === "skip-link") {
        await page.keyboard.press("Tab");
        const skipToMain = page.getByRole("link", { name: /skip to main content/i });
        await expect(skipToMain).toBeVisible();

        await page.keyboard.press("Enter");

        await expect
          .poll(async () => page.evaluate(() => document.activeElement?.id))
          .toBe("main-content");
      }
    });
  });
}
