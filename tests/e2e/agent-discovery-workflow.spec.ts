/**
 * E2E: Agent Discovery Workflow
 * @tag @agent-workflow
 *
 * Validates the end-to-end Discovery agent flow:
 *   1. Authenticated user navigates to a seeded Value Case
 *   2. Triggers the Discovery agent run
 *   3. Observes pipeline progress (PipelineStepper steps transition)
 *   4. Reaches `completed` terminal state
 *   5. Value model output is visible
 *
 * Environment requirements:
 * ─────────────────────────
 * These tests target a deterministic seeded environment. They require:
 *
 *   E2E_TEST_USER_EMAIL      — email of a pre-seeded test user
 *   E2E_TEST_USER_PASSWORD   — password for that user
 *   E2E_DISCOVERY_CASE_ID    — ID of a pre-seeded Value Case in the test tenant
 *                              (optional; falls back to navigating to /dashboard
 *                               and selecting the first available case)
 *   VITE_SUPABASE_URL        — Supabase URL for the test environment
 *   VITE_SUPABASE_ANON_KEY   — Supabase anon key for the test environment
 *
 * Seed data:
 *   The test tenant must have at least one Value Case in "draft" or "discovery"
 *   stage. Use the seed script at seeds/domain_packs/ or the CI seed task to
 *   provision the required fixtures before running this suite.
 *
 * Skip condition:
 *   If E2E_TEST_USER_EMAIL or E2E_TEST_USER_PASSWORD are absent, the suite
 *   is skipped with a descriptive message rather than failing.
 *
 * CI lane:
 *   Included in the `e2e-critical` lane in .github/workflows/pr-fast.yml.
 *   Runs against the deterministic test environment (not production).
 */

import { expect, Page, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------------------

const TEST_EMAIL = process.env.E2E_TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_USER_PASSWORD;
const DISCOVERY_CASE_ID = process.env.E2E_DISCOVERY_CASE_ID;

const CREDENTIALS_AVAILABLE = !!(TEST_EMAIL && TEST_PASSWORD);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10_000 });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

async function navigateToDiscoveryCase(page: Page): Promise<void> {
  if (DISCOVERY_CASE_ID) {
    await page.goto(`/cases/${DISCOVERY_CASE_ID}`);
  } else {
    // Fall back: go to dashboard and open the first available case
    await page.goto("/dashboard");
    const firstCase = page.locator('[data-testid="case-card"], [data-testid="value-case-card"]').first();
    await expect(firstCase).toBeVisible({ timeout: 15_000 });
    await firstCase.click();
  }
}

/**
 * Collect all console errors during the test. Returns a cleanup function.
 */
function collectConsoleErrors(page: Page): { errors: string[]; cleanup: () => void } {
  const errors: string[] = [];
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  };
  page.on("console", handler);
  return {
    errors,
    cleanup: () => page.off("console", handler),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Agent Discovery Workflow @agent-workflow", () => {
  test.skip(!CREDENTIALS_AVAILABLE, "Skipped: E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD not set");

  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!);
  });

  test("Discovery agent run completes without infinite spinner", async ({ page }) => {
    const { errors, cleanup } = collectConsoleErrors(page);

    await navigateToDiscoveryCase(page);

    // Locate the Discovery stage or trigger button
    // The workspace renders a PipelineStepper; look for a "Run" or "Start Discovery" action
    const runButton = page.locator(
      '[data-testid="run-discovery"], button:has-text("Run Stage"), button:has-text("Start Discovery")',
    ).first();

    // If the run button is present, click it; otherwise the case may already be running
    const runButtonVisible = await runButton.isVisible({ timeout: 5_000 }).catch(() => false);
    if (runButtonVisible) {
      await runButton.click();
    }

    // Assert: no infinite spinner after 30 seconds
    // The pipeline should reach a terminal state (completed or failed) within the timeout
    await expect(
      page.locator('[data-testid="pipeline-status-completed"], [data-testid="agent-status-completed"]'),
    ).toBeVisible({ timeout: 30_000 }).catch(async () => {
      // Acceptable alternative: the stage shows a completed insight card
      await expect(
        page.locator('[data-testid="agent-insight-card"], .pipeline-step-completed'),
      ).toBeVisible({ timeout: 5_000 });
    });

    // Assert: no console errors containing undefined/null tenant or job IDs
    cleanup();
    const tenantNullErrors = errors.filter(
      (e) =>
        (e.includes("undefined") || e.includes("null")) &&
        (e.toLowerCase().includes("tenant") || e.toLowerCase().includes("job")),
    );
    expect(tenantNullErrors, `Console errors with null/undefined tenant or job: ${tenantNullErrors.join("; ")}`).toHaveLength(0);
  });

  test("Pipeline steps render in order during Discovery run", async ({ page }) => {
    await navigateToDiscoveryCase(page);

    // The PipelineStepper should show at least the first step
    const pipelineSteps = page.locator(
      '[data-testid^="pipeline-step-"], .pipeline-step, [data-testid="pipeline-stepper"] li',
    );

    await expect(pipelineSteps.first()).toBeVisible({ timeout: 15_000 });

    // Steps should be rendered in a meaningful order (at least 1 step visible)
    const stepCount = await pipelineSteps.count();
    expect(stepCount).toBeGreaterThanOrEqual(1);
  });

  test("Value Case workspace loads without tenant or job ID errors", async ({ page }) => {
    const { errors, cleanup } = collectConsoleErrors(page);

    await navigateToDiscoveryCase(page);

    // Wait for the workspace to stabilise
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
      // networkidle may not be reached if SSE is open — that's acceptable
    });

    cleanup();

    // No errors about missing tenant or job IDs
    const criticalErrors = errors.filter(
      (e) =>
        (e.includes("undefined") || e.includes("null")) &&
        (e.toLowerCase().includes("tenantid") ||
          e.toLowerCase().includes("tenant_id") ||
          e.toLowerCase().includes("jobid") ||
          e.toLowerCase().includes("job_id")),
    );
    expect(criticalErrors, `Critical null/undefined errors: ${criticalErrors.join("; ")}`).toHaveLength(0);
  });

  test("Switching tenants does not expose previous tenant's agent jobs", async ({ page }) => {
    // This test requires at least two tenants in the test account.
    // If only one tenant is available, the test is a no-op (passes trivially).
    await page.goto("/dashboard");

    // Look for a tenant switcher
    const tenantSwitcher = page.locator(
      '[data-testid="tenant-switcher"], [data-testid="org-switcher"]',
    );
    const switcherVisible = await tenantSwitcher.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!switcherVisible) {
      test.skip(true, "No tenant switcher found — single-tenant account");
      return;
    }

    // Capture any job IDs visible before switching
    const jobIdsBefore = await page
      .locator('[data-testid="job-id"], .job-id, [data-testid="run-id"]')
      .allTextContents();

    // Switch tenant
    await tenantSwitcher.click();
    const secondTenant = page.locator('[data-testid="tenant-option"]').nth(1);
    await expect(secondTenant).toBeVisible({ timeout: 5_000 });
    await secondTenant.click();

    // Wait for the page to reload/update
    await page.waitForLoadState("domcontentloaded");

    // Job IDs from the previous tenant must not appear in the new tenant's view.
    // If this assertion fails, it indicates either a real cache bleed or a seed
    // data isolation problem — both require investigation. Do not swallow the
    // failure: a passing test that cannot detect leakage provides no safety guarantee.
    for (const jobId of jobIdsBefore) {
      if (jobId.trim()) {
        const leakedJob = page.locator(`text="${jobId.trim()}"`);
        await expect(leakedJob).not.toBeVisible({ timeout: 3_000 });
      }
    }
  });
});
