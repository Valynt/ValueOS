import { expect, test } from '@playwright/test';

type CandidateLocator = import('@playwright/test').Locator;

test.describe.configure({ mode: 'serial', timeout: 120000 });

const MONITOR_EMAIL = process.env.MONITOR_EMAIL || '';
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD || '';
const MONITOR_OTP = process.env.MONITOR_OTP || '';
const EXPORT_FORMAT = process.env.MONITOR_EXPORT_FORMAT || 'csv';

async function notifyPagerDuty(
  testInfo: import('@playwright/test').TestInfo,
  errorMessage: string,
) {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    console.warn('Skipping PagerDuty alert because PAGERDUTY_ROUTING_KEY is not set');
    return;
  }

  const payload = {
    routing_key: routingKey,
    event_action: 'trigger' as const,
    dedup_key: `valuecanvas-golden-path-${testInfo.title.replace(/\s+/g, '-').toLowerCase()}`,
    payload: {
      summary: errorMessage,
      source: 'valuecanvas-synthetic-monitor',
      severity: 'error',
      component: 'golden-path-monitor',
      custom_details: {
        test: testInfo.title,
        url: testInfo.project.name,
        runId: process.env.GITHUB_RUN_ID,
      },
    },
  };

  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error('Failed to send PagerDuty alert', await response.text());
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

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== 'passed') {
    await notifyPagerDuty(testInfo, testInfo.error?.message || 'Golden path monitor failure');
  }
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');

  await page.getByLabel(/email address/i).fill(MONITOR_EMAIL);
  await page.getByLabel(/password/i).fill(MONITOR_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  if (MONITOR_OTP) {
    const otpInput = page.getByLabel(/mfa code|otp/i);
    if (await otpInput.isVisible().catch(() => false)) {
      await otpInput.fill(MONITOR_OTP);
      await page.getByRole('button', { name: /verify|continue/i }).click();
    }
  }

  await Promise.race([
    page.waitForURL(/\/(dashboard|home|workspace|reports|app|)$/i, { timeout: 20000 }).catch(() => null),
    page.waitForSelector('#root > *', { timeout: 20000 }).catch(() => null),
    page.waitForSelector('[data-testid="app-shell"]', { timeout: 20000 }).catch(() => null),
  ]);
}

async function createReport(page: import('@playwright/test').Page, reportName: string) {
  const reportNav = await getFirstVisible(
    [
      page.getByRole('link', { name: /reports?/i }),
      page.getByRole('navigation').getByText(/reports?/i),
      page.getByText(/report builder/i),
    ],
    'report navigation',
  );
  await reportNav.click();

  const createButton = await getFirstVisible(
    [
      page.getByRole('button', { name: /create report|new report|report builder/i }),
      page.getByText(/create.*report/i),
    ],
    'report creation trigger',
  );
  await createButton.click();

  const nameField = page.getByLabel(/report name|title/i).first();
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill(reportName);
  }

  const saveButton = await getFirstVisible(
    [
      page.getByRole('button', { name: /save|create|generate/i }),
      page.getByText(/generate report/i),
    ],
    'report save action',
  );
  await saveButton.click();

  await expect(page.getByText(reportName).first()).toBeVisible({ timeout: 20000 });
}

async function exportReport(page: import('@playwright/test').Page) {
  const exportButton = await getFirstVisible(
    [
      page.getByRole('button', { name: /export|download/i }),
      page.getByText(/export report/i),
    ],
    'report export action',
  );

  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  await exportButton.click();
  const download = await downloadPromise;

  const suggestedName = download.suggestedFilename();
  expect(suggestedName.toLowerCase()).toContain(EXPORT_FORMAT);
  expect(await download.path()).not.toBeNull();
}

test('golden path: login, create report, export', async ({ page }) => {
  if (!MONITOR_EMAIL || !MONITOR_PASSWORD) {
    test.skip('Missing MONITOR_EMAIL or MONITOR_PASSWORD');
  }

  const reportName = `Monitor Report ${new Date().toISOString()}`;

  await login(page);
  await createReport(page, reportName);
  await exportReport(page);
});
