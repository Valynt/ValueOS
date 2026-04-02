import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AuditedPage = {
  name: string;
  path: string;
  componentChecks: Array<{ selector: string; description: string }>;
};

const PAGES: AuditedPage[] = [
  {
    name: "Home / Login",
    path: "/",
    componentChecks: [
      { selector: "main", description: "main landmark" },
      { selector: "form", description: "auth form" },
    ],
  },
  {
    name: "Dashboard",
    path: "/dashboard",
    componentChecks: [
      { selector: "main", description: "main landmark" },
      { selector: "[role='navigation']", description: "navigation landmark" },
    ],
  },
  {
    name: "Auth - Sign In",
    path: "/auth/login",
    componentChecks: [
      { selector: "input", description: "interactive fields" },
      { selector: "button", description: "action buttons" },
    ],
  },
  {
    name: "Auth - Sign Up",
    path: "/signup",
    componentChecks: [
      { selector: "form", description: "auth form" },
      { selector: "button", description: "action buttons" },
    ],
  },
  {
    name: "Auth - Reset Password",
    path: "/reset-password",
    componentChecks: [
      { selector: "form", description: "password reset form" },
      { selector: "button", description: "action buttons" },
    ],
  },
  {
    name: "Marketing Blog",
    path: "/blog",
    componentChecks: [{ selector: "main", description: "main content region" }],
  },
  {
    name: "Settings",
    path: "/settings",
    componentChecks: [
      { selector: "main", description: "main settings container" },
    ],
  },
  {
    name: "Opportunity Discovery",
    path: "/opportunities",
    componentChecks: [
      { selector: "main, form", description: "primary route container" },
    ],
  },
  {
    name: "Opportunity Detail",
    path: "/opportunities/demo-opportunity",
    componentChecks: [
      { selector: "main, form", description: "primary route container" },
    ],
  },
  {
    name: "Value Case Authoring",
    path: "/opportunities/demo-opportunity/cases/demo-case",
    componentChecks: [
      { selector: "main, form", description: "primary route container" },
    ],
  },
  {
    name: "Workspace Stage - Model",
    path: "/workspace/demo-case/model",
    componentChecks: [
      { selector: "main, form", description: "primary route container" },
    ],
  },
  {
    name: "Integrations",
    path: "/integrations",
    componentChecks: [
      { selector: "main, form", description: "primary route container" },
    ],
  },
  {
    name: "Billing",
    path: "/billing",
    componentChecks: [
      { selector: "main, form", description: "primary route container" },
    ],
  },
];

function summarizeViolations(violations: AxeBuilder.AxeResults["violations"]) {
  return violations
    .map(
      v =>
        `[${v.impact ?? "unknown"}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))\n` +
        v.nodes.map(n => `  - ${n.html.substring(0, 120)}`).join("\n")
    )
    .join("\n\n");
}

for (const page of PAGES) {
  test.describe(`Accessibility: ${page.name}`, () => {
    test(`should have no critical WCAG 2.2 AA violations`, async ({
      page: p,
    }) => {
      test.info().annotations.push({
        type: "a11y-evidence",
        description: `runtime-executable:axe:${page.path}`,
      });

      await p.goto(page.path, { waitUntil: "networkidle" });

      const navigationTiming = await p.evaluate(() => {
        const entry = performance.getEntriesByType("navigation")[0] as
          | PerformanceNavigationTiming
          | undefined;
        if (!entry) {
          return { domContentLoadedMs: null, loadEventMs: null };
        }

        return {
          domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
          loadEventMs: Math.round(entry.loadEventEnd),
        };
      });

      test.info().annotations.push({
        type: "route-load",
        description: JSON.stringify({ path: page.path, ...navigationTiming }),
      });

      const results = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();

      const violationsSummary = summarizeViolations(results.violations);
      if (violationsSummary.length > 0) {
        test.info().annotations.push({
          type: "a11y-violations-all",
          description: violationsSummary,
        });
      }

      const critical = results.violations.filter(v => v.impact === "critical");

      if (critical.length > 0) {
        test.info().annotations.push({
          type: "a11y-violations",
          description: summarizeViolations(critical),
        });
      }

      expect(
        critical,
        `Found ${critical.length} critical accessibility violations on ${page.path}`
      ).toHaveLength(0);
    });

    test("should include audited route-level components", async ({
      page: p,
    }) => {
      test.info().annotations.push({
        type: "a11y-evidence",
        description: `runtime-executable:dom-audit:${page.path}`,
      });

      await p.goto(page.path, { waitUntil: "networkidle" });

      for (const check of page.componentChecks) {
        const locator = p.locator(check.selector).first();
        await expect(
          locator,
          `Missing ${check.description} on ${page.path}`
        ).toBeVisible();
      }
    });
  });
}
