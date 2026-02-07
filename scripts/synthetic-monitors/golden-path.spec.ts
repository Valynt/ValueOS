import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

type CandidateLocator = import("@playwright/test").Locator;

test.describe.configure({ mode: "serial", timeout: 300000 }); // 5 minutes per test

const MONITOR_EMAIL = process.env.MONITOR_EMAIL || "test@example.com";
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD || "TestPass123!";
const MONITOR_OTP = process.env.MONITOR_OTP || "";
const ITERATIONS = process.env.CI ? 50 : 3; // Fewer iterations for local development

// Load performance baselines from quality-baselines.json
const qualityBaselinesPath = path.join(process.cwd(), "quality-baselines.json");
const qualityBaselines = JSON.parse(fs.readFileSync(qualityBaselinesPath, "utf-8"));
const PERFORMANCE_BASELINES = {
  timeToInteraction: {
    p50: qualityBaselines.performance?.time_to_interaction?.p50_ms || 2000,
    p95: qualityBaselines.performance?.time_to_interaction?.p95_ms || 5000,
    p99: qualityBaselines.performance?.time_to_interaction?.p99_ms || 10000,
  },
  heapGrowthPerIteration:
    (qualityBaselines.performance?.memory_leak_detection?.max_heap_growth_per_iteration_mb || 50) *
    1024 *
    1024,
  maxTotalHeapGrowth:
    (qualityBaselines.performance?.memory_leak_detection?.max_total_heap_growth_mb || 1000) *
    1024 *
    1024,
  maxDurationPerIteration:
    qualityBaselines.performance?.synthetic_user_journey?.max_duration_per_iteration_ms || 120000,
};

// Memory monitoring
let initialHeapUsage: NodeJS.MemoryUsage;
let heapUsageHistory: number[] = [];
let performanceMetrics: {
  timeToInteraction: number[];
  totalDuration: number;
} = {
  timeToInteraction: [],
  totalDuration: 0,
};

async function notifyPagerDuty(
  testInfo: import("@playwright/test").TestInfo,
  errorMessage: string
) {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    console.warn("Skipping PagerDuty alert because PAGERDUTY_ROUTING_KEY is not set");
    return;
  }

  const payload = {
    routing_key: routingKey,
    event_action: "trigger" as const,
    dedup_key: `valuecanvas-golden-path-${testInfo.title.replace(/\s+/g, "-").toLowerCase()}`,
    payload: {
      summary: errorMessage,
      source: "valuecanvas-synthetic-monitor",
      severity: "error",
      component: "golden-path-monitor",
      custom_details: {
        test: testInfo.title,
        url: testInfo.project.name,
        runId: process.env.GITHUB_RUN_ID,
      },
    },
  };

  const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error("Failed to send PagerDuty alert", await response.text());
  }
}

async function getFirstVisible(candidates: CandidateLocator[], description: string) {
  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  throw new Error(`Could not find a visible element for ${description}`);
}

test.beforeAll(() => {
  initialHeapUsage = process.memoryUsage();
  console.log(`Initial heap usage: ${Math.round(initialHeapUsage.heapUsed / 1024 / 1024)}MB`);
});

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== "passed") {
    await notifyPagerDuty(testInfo, testInfo.error?.message || "Golden path monitor failure");
  }
});

test.afterAll(() => {
  const finalHeapUsage = process.memoryUsage();
  const heapGrowth = finalHeapUsage.heapUsed - initialHeapUsage.heapUsed;
  const avgHeapGrowthPerIteration = heapGrowth / ITERATIONS;

  console.log(`\n=== Memory Leak Analysis ===`);
  console.log(`Initial heap: ${Math.round(initialHeapUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`Final heap: ${Math.round(finalHeapUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`Total growth: ${Math.round(heapGrowth / 1024 / 1024)}MB`);
  console.log(`Avg growth per iteration: ${Math.round(avgHeapGrowthPerIteration / 1024 / 1024)}MB`);

  if (avgHeapGrowthPerIteration > PERFORMANCE_BASELINES.heapGrowthPerIteration) {
    console.error(
      `❌ MEMORY LEAK DETECTED: Heap growth exceeds baseline (${Math.round(PERFORMANCE_BASELINES.heapGrowthPerIteration / 1024 / 1024)}MB per iteration)`
    );
    throw new Error("Memory leak detected in synthetic user journey");
  } else if (heapGrowth > PERFORMANCE_BASELINES.maxTotalHeapGrowth) {
    console.error(
      `❌ MEMORY LEAK DETECTED: Total heap growth exceeds baseline (${Math.round(PERFORMANCE_BASELINES.maxTotalHeapGrowth / 1024 / 1024)}MB total)`
    );
    throw new Error("Memory leak detected in synthetic user journey");
  } else {
    console.log(`✅ Memory usage within acceptable limits`);
  }

  console.log(`\n=== Performance Analysis ===`);
  const ttiMetrics = performanceMetrics.timeToInteraction;
  if (ttiMetrics.length > 0) {
    const sortedTTI = [...ttiMetrics].sort((a, b) => a - b);
    const p50 = sortedTTI[Math.floor(sortedTTI.length * 0.5)];
    const p95 = sortedTTI[Math.floor(sortedTTI.length * 0.95)];
    const p99 = sortedTTI[Math.floor(sortedTTI.length * 0.99)];

    console.log(`Time to Interaction (TTI) percentiles:`);
    console.log(`  P50: ${p50}ms (baseline: ${PERFORMANCE_BASELINES.timeToInteraction.p50}ms)`);
    console.log(`  P95: ${p95}ms (baseline: ${PERFORMANCE_BASELINES.timeToInteraction.p95}ms)`);
    console.log(`  P99: ${p99}ms (baseline: ${PERFORMANCE_BASELINES.timeToInteraction.p99}ms)`);

    if (p95 > PERFORMANCE_BASELINES.timeToInteraction.p95) {
      console.error(`❌ PERFORMANCE REGRESSION: P95 TTI exceeds baseline`);
      throw new Error("Performance regression detected in Time to Interaction");
    } else {
      console.log(`✅ Performance within acceptable limits`);
    }
  }

  console.log(`Total test duration: ${performanceMetrics.totalDuration}ms`);
  console.log(`Average iteration duration: ${performanceMetrics.totalDuration / ITERATIONS}ms`);
});

async function login(page: import("@playwright/test").Page) {
  const startTime = Date.now();

  await page.goto("/login");

  await page.fill('input[name="email"]', MONITOR_EMAIL);
  await page.fill('input[name="password"]', MONITOR_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to /app
  await page.waitForURL("/app", { timeout: 20000 });

  const timeToInteraction = Date.now() - startTime;
  performanceMetrics.timeToInteraction.push(timeToInteraction);

  console.log(`Login TTI: ${timeToInteraction}ms`);
}

async function discoverOpportunity(page: import("@playwright/test").Page) {
  // Navigate to cases page for opportunity discovery
  await page.goto("/app/cases");

  // Wait for cases page to load
  await page.waitForSelector(
    '[data-testid="cases-page"], .cases-container, [data-testid="case-list"]',
    { timeout: 10000 }
  );

  // Click "New Case" or "Create Opportunity" button
  const createButton = await getFirstVisible(
    [
      page.getByRole("button", { name: /new case|create case|add case|discover opportunity/i }),
      page.getByText(/new case|create opportunity/i),
      page.locator('[data-testid="create-case-button"]'),
    ],
    "create case button"
  );
  await createButton.click();

  // Wait for case creation form or opportunity discovery interface
  await page.waitForSelector(
    '[data-testid="case-form"], [data-testid="opportunity-discovery"], .case-creation-form',
    { timeout: 10000 }
  );
}

async function generateTarget(page: import("@playwright/test").Page) {
  // We're now in the case workspace (/app/cases/new or /app/cases/:id)
  // Wait for the workspace to load
  await page.waitForSelector(
    '[data-testid="case-workspace"], .workspace-container, [data-testid="canvas-workspace"]',
    { timeout: 10000 }
  );

  // Look for target generation interface
  const targetInterface = await getFirstVisible(
    [
      page.locator('[data-testid="target-builder"]'),
      page.locator('[data-testid="goal-setting"]'),
      page.locator(".target-generation"),
      page.getByText(/generate target|create goal|set target/i),
    ],
    "target generation interface"
  );

  // If there's a button to start target generation, click it
  if ((await targetInterface.isVisible()) && (await targetInterface.isEnabled())) {
    await targetInterface.click();
  }

  // Wait for target generation to complete or show results
  await page.waitForSelector(
    '[data-testid="generated-target"], .target-result, [data-testid="goal-result"]',
    { timeout: 30000 }
  );

  // Verify target was generated
  const targetResult = await getFirstVisible(
    [
      page.locator('[data-testid="generated-target"]'),
      page.locator(".target-result"),
      page.locator('[data-testid="goal-result"]'),
    ],
    "generated target result"
  );
  await expect(targetResult).toBeVisible();
}

async function approveChange(page: import("@playwright/test").Page) {
  // Look for approval/confirmation interface in the current workspace
  const approvalInterface = await getFirstVisible(
    [
      page.locator('[data-testid="approval-section"]'),
      page.locator('[data-testid="change-approval"]'),
      page.locator(".approval-workflow"),
      page.getByText(/approve|confirm|submit/i),
    ],
    "approval interface"
  );

  // If there's an approval button, click it
  if ((await approvalInterface.isVisible()) && (await approvalInterface.isEnabled())) {
    await approvalInterface.click();
  }

  // Wait for approval confirmation
  await page.waitForSelector(
    '[data-testid="approval-confirmed"], .approval-success, [data-testid="change-approved"]',
    { timeout: 10000 }
  );

  // Verify approval was successful
  const confirmation = await getFirstVisible(
    [
      page.locator('[data-testid="approval-confirmed"]'),
      page.locator(".approval-success"),
      page.locator('[data-testid="change-approved"]'),
    ],
    "approval confirmation"
  );
  await expect(confirmation).toBeVisible();
}

async function runUserJourney(page: import("@playwright/test").Page, iteration: number) {
  const startTime = Date.now();
  console.log(`\n--- Starting iteration ${iteration + 1}/${ITERATIONS} ---`);

  try {
    await login(page);
    await discoverOpportunity(page);
    await generateTarget(page);
    await approveChange(page);

    const duration = Date.now() - startTime;
    if (duration > PERFORMANCE_BASELINES.maxDurationPerIteration) {
      console.error(
        `❌ PERFORMANCE ISSUE: Iteration ${iteration + 1} took ${duration}ms (exceeds ${PERFORMANCE_BASELINES.maxDurationPerIteration}ms baseline)`
      );
      throw new Error(
        `Iteration duration exceeded baseline: ${duration}ms > ${PERFORMANCE_BASELINES.maxDurationPerIteration}ms`
      );
    }
    performanceMetrics.totalDuration += duration;
    console.log(`✅ Iteration ${iteration + 1} completed in ${duration}ms`);

    // Monitor heap usage
    const currentHeap = process.memoryUsage().heapUsed;
    heapUsageHistory.push(currentHeap);
    console.log(`Heap usage: ${Math.round(currentHeap / 1024 / 1024)}MB`);
  } catch (error) {
    console.error(`❌ Iteration ${iteration + 1} failed:`, error);
    throw error;
  }
}

test("golden path: end-to-end user journey with memory leak detection", async ({ page }) => {
  // Skip if explicitly disabled
  test.skip(process.env.SKIP_GOLDEN_PATH === "true", "Golden path test skipped");

  // Run the complete user journey ITERATIONS times for memory leak detection
  for (let i = 0; i < ITERATIONS; i++) {
    await runUserJourney(page, i);

    // Brief pause between iterations to allow garbage collection
    await page.waitForTimeout(1000);
  }
});
