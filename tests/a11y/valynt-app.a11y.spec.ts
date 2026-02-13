import { test } from "@playwright/test";
import {
  assertFocusOrderDoesNotTrap,
  assertKeyboardCanReachMainLandmarks,
  checkNoSeriousOrCriticalViolations,
} from "./utils/a11y";

const baseUrl = "http://127.0.0.1:4173";

const highTrafficPages = [
  { name: "Valynt login", path: "/login" },
  { name: "Valynt signup", path: "/signup" },
  { name: "Valynt reset password", path: "/reset-password" },
];

test.describe("ValyntApp accessibility baselines", () => {
  for (const pageConfig of highTrafficPages) {
    test(`${pageConfig.name} meets minimum WCAG 2.2 AA gate`, async ({ page }) => {
      await page.goto(`${baseUrl}${pageConfig.path}`);
      await checkNoSeriousOrCriticalViolations(page, pageConfig.name);
    });
  }

  test("Valynt auth flow supports keyboard-only navigation and sane focus order", async ({ page }) => {
    await page.goto(`${baseUrl}/login`);
    await assertKeyboardCanReachMainLandmarks(page);
    await assertFocusOrderDoesNotTrap(page);
  });
});
