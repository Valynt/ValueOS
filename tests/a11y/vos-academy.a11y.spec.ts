import { test } from "@playwright/test";
import {
  assertFocusOrderDoesNotTrap,
  assertKeyboardCanReachMainLandmarks,
  checkNoSeriousOrCriticalViolations,
} from "./utils/a11y";

const baseUrl = "http://127.0.0.1:4174";

async function mockAuthenticatedTrpc(page: import("@playwright/test").Page) {
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const rawProcedures = url.pathname.split("/api/trpc/")[1] ?? "";
    const procedures = rawProcedures.split(",").filter(Boolean);

    const payload = procedures.map((procedure) => {
      if (procedure === "auth.me") {
        return {
          result: {
            data: {
              id: "user-1",
              openId: "user-1",
              name: "Accessibility Tester",
              email: "a11y@example.com",
              vosRole: "AE",
              maturityLevel: 2,
            },
          },
        };
      }

      if (procedure === "progress.getUserProgress") {
        return { result: { data: [] } };
      }

      if (procedure === "quiz.getResults") {
        return { result: { data: [] } };
      }

      if (procedure === "simulations.getRecommendations") {
        return {
          result: {
            data: {
              overallGuidance: "Focus on Pillar 2 to improve business outcomes.",
              nextSimulations: [],
              pillarsToStudy: [],
              improvementAreas: [],
            },
          },
        };
      }

      return { result: { data: null } };
    });

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(payload.length === 1 ? payload[0] : payload),
    });
  });
}

test.describe("VOSAcademy accessibility baselines", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedTrpc(page);
  });

  test("VOS home/auth page meets minimum WCAG 2.2 AA gate", async ({ page }) => {
    await page.goto(`${baseUrl}/`);
    await checkNoSeriousOrCriticalViolations(page, "VOS home/auth");
  });

  test("VOS dashboard meets minimum WCAG 2.2 AA gate", async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard`);
    await checkNoSeriousOrCriticalViolations(page, "VOS dashboard");
  });

  test("VOS key workflow page (/simulations) meets minimum WCAG 2.2 AA gate", async ({ page }) => {
    await page.goto(`${baseUrl}/simulations`);
    await checkNoSeriousOrCriticalViolations(page, "VOS simulations workflow");
  });

  test("VOS auth, dashboard, and workflow pages support keyboard-only flow and focus order", async ({ page }) => {
    for (const path of ["/", "/dashboard", "/simulations"]) {
      await page.goto(`${baseUrl}${path}`);
      await assertKeyboardCanReachMainLandmarks(page);
      await assertFocusOrderDoesNotTrap(page);
    }
  });
});
