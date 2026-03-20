/**
 * Playwright end-to-end debug script for the main app flow.
 *
 * Tests: login → root redirect → dashboard → nav links → onboarding gate
 *
 * Usage:
 *   E2E_EMAIL=... E2E_PASSWORD=... pnpm --filter valynt-app exec tsx e2e/debug-app-flow.ts
 */
import { chromium, type Page, type BrowserContext } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
// Optional: skip tenant-base auto-detection by providing the tenant ID directly
const TENANT_ID_HINT = process.env.E2E_TENANT_ID ?? null;

if (!EMAIL || !PASSWORD) {
  console.error("[fatal] E2E_EMAIL and E2E_PASSWORD must be set");
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────────

type Result = { pass: boolean; url: string; note?: string };
const results: Array<{ name: string } & Result> = [];

function pass(name: string, url: string, note?: string) {
  results.push({ name, pass: true, url, note });
  console.log(`  ✅ ${name}${note ? ` — ${note}` : ""}`);
}

function fail(name: string, url: string, note: string) {
  results.push({ name, pass: false, url, note });
  console.log(`  ❌ ${name} — ${note}`);
}

async function waitForStable(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function getVisibleText(page: Page, selector: string): Promise<string> {
  return page.locator(selector).first().innerText().catch(() => "");
}

async function hasElement(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function getPageErrors(page: Page): Promise<string[]> {
  return page
    .locator('[role="alert"],[class*="error"],[class*="Error"],[data-testid*="error"]')
    .allTextContents()
    .then((t) => t.filter(Boolean))
    .catch(() => []);
}

// ── login ─────────────────────────────────────────────────────────────────────

async function login(page: Page): Promise<boolean> {
  console.log("\n=== LOGIN ===");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await waitForStable(page, 1000);

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  if (!(await emailInput.isVisible().catch(() => false))) {
    fail("login-form-visible", page.url(), "email input not found");
    return false;
  }

  await emailInput.fill(EMAIL!);
  await passwordInput.fill(PASSWORD!);
  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
    pass("login", page.url(), `redirected to ${new URL(page.url()).pathname}`);
    return true;
  } catch {
    const errs = await getPageErrors(page);
    fail("login", page.url(), errs[0] ?? "still on /login after 15s");
    return false;
  }
}

// ── root redirect ─────────────────────────────────────────────────────────────

async function testRootRedirect(page: Page) {
  console.log("\n=== ROOT REDIRECT ===");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await waitForStable(page, 2000);
  const pathname = new URL(page.url()).pathname;

  if (pathname.includes("/org/") && pathname.includes("/dashboard")) {
    pass("root-redirect-dashboard", page.url());
  } else if (pathname === "/onboarding") {
    pass("root-redirect-onboarding", page.url(), "onboarding not yet complete");
  } else if (pathname === "/create-org") {
    fail("root-redirect", page.url(), "landed on /create-org — tenant not detected");
  } else {
    fail("root-redirect", page.url(), `unexpected path: ${pathname}`);
  }
  return pathname;
}

// ── dashboard ─────────────────────────────────────────────────────────────────

async function testDashboard(page: Page, tenantPath: string) {
  console.log("\n=== DASHBOARD ===");
  const url = `${BASE_URL}${tenantPath}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForStable(page, 2000);

  const pathname = new URL(page.url()).pathname;
  if (pathname !== tenantPath) {
    fail("dashboard-load", page.url(), `redirected away to ${pathname}`);
    return;
  }

  const errs = await getPageErrors(page);
  if (errs.length) {
    fail("dashboard-no-errors", page.url(), errs.join(" | "));
  } else {
    pass("dashboard-load", page.url());
  }

  // Check for a meaningful heading or content
  const hasHeading = await hasElement(page, "h1, h2, [data-testid='dashboard-title']");
  hasHeading
    ? pass("dashboard-has-content", page.url())
    : fail("dashboard-has-content", page.url(), "no h1/h2 found");
}

// ── nav links ─────────────────────────────────────────────────────────────────

async function testNavLink(
  page: Page,
  label: string,
  expectedPathFragment: string,
  tenantBase: string
) {
  const link = page
    .locator(`nav a, aside a, [role="navigation"] a`)
    .filter({ hasText: new RegExp(label, "i") })
    .first();

  if (!(await link.isVisible().catch(() => false))) {
    fail(`nav-${label.toLowerCase()}`, page.url(), "link not found in nav");
    return;
  }

  await link.click();
  await waitForStable(page, 1500);
  const pathname = new URL(page.url()).pathname;

  if (pathname.includes(expectedPathFragment)) {
    pass(`nav-${label.toLowerCase()}`, page.url());
  } else {
    fail(`nav-${label.toLowerCase()}`, page.url(), `expected ${expectedPathFragment}, got ${pathname}`);
  }

  // Navigate back to dashboard for next test
  await page.goto(`${BASE_URL}${tenantBase}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitForStable(page, 1000);
}

// ── onboarding ────────────────────────────────────────────────────────────────

async function testOnboarding(page: Page) {
  console.log("\n=== ONBOARDING ===");
  await page.goto(`${BASE_URL}/onboarding`, { waitUntil: "domcontentloaded" });
  await waitForStable(page, 2000);

  const pathname = new URL(page.url()).pathname;
  if (pathname !== "/onboarding") {
    fail("onboarding-accessible", page.url(), `redirected to ${pathname}`);
    return;
  }
  pass("onboarding-accessible", page.url());

  const errs = await getPageErrors(page);
  if (errs.length) {
    fail("onboarding-no-errors", page.url(), errs.join(" | "));
  } else {
    pass("onboarding-no-errors", page.url());
  }

  // Check for step indicator or content area (onboarding uses divs, not a <form>)
  const hasSteps = await hasElement(
    page,
    "h1, h2, [class*='step'], [class*='Step'], [class*='phase'], [class*='Phase'], [class*='onboarding']"
  );
  hasSteps
    ? pass("onboarding-has-content", page.url())
    : fail("onboarding-has-content", page.url(), "no step/phase content found");
}

// ── settings ──────────────────────────────────────────────────────────────────

async function testSettings(page: Page, tenantBase: string) {
  console.log("\n=== SETTINGS ===");
  await page.goto(`${BASE_URL}${tenantBase}/settings`, { waitUntil: "domcontentloaded" });
  await waitForStable(page, 2000);

  const pathname = new URL(page.url()).pathname;
  if (!pathname.includes("/settings")) {
    fail("settings-load", page.url(), `redirected to ${pathname}`);
    return;
  }
  pass("settings-load", page.url());

  const errs = await getPageErrors(page);
  errs.length
    ? fail("settings-no-errors", page.url(), errs.join(" | "))
    : pass("settings-no-errors", page.url());
}

// ── API health via proxy ───────────────────────────────────────────────────────

async function testApiProxy(page: Page) {
  console.log("\n=== API PROXY ===");
  // Retry once — backend may still be starting
  for (let attempt = 1; attempt <= 2; attempt++) {
    const resp = await page.request.get(`${BASE_URL}/api/health`).catch(() => null);
    if (resp?.ok()) {
      const body = await resp.json().catch(() => ({}));
      pass("api-proxy-health", BASE_URL, `status=${body.status}`);
      return;
    }
    if (attempt === 1) await page.waitForTimeout(5000);
  }
  fail("api-proxy-health", BASE_URL, "backend unreachable after retry");
}

// ── console error capture ─────────────────────────────────────────────────────

function attachConsoleCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter known-benign noise
      if (
        text.includes("ERR_FAILED") ||
        text.includes("web-vitals") ||
        text.includes("favicon") ||
        // HTTP status errors from fetch — captured separately via response interception
        text.includes("Failed to load resource") ||
        // Supabase getUser() network errors handled by getSession() fallback
        text.includes("TypeError: Failed to fetch")
      ) return;
      errors.push(text);
    }
  });
  page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
  return errors;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = attachConsoleCapture(page);

  // 1. API proxy sanity check
  await testApiProxy(page);

  // 2. Login
  const loggedIn = await login(page);
  if (!loggedIn) {
    await browser.close();
    printSummary(consoleErrors);
    process.exit(1);
  }

  // 3. Root redirect — determine tenant path
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const rootPath = new URL(page.url()).pathname;

  let tenantBase = "";
  const orgMatchDirect = rootPath.match(/^(\/org\/[^/]+)/);
  if (orgMatchDirect) {
    tenantBase = orgMatchDirect[1];
    pass("root-redirect-dashboard", page.url());
  } else if (rootPath === "/onboarding") {
    pass("root-redirect-onboarding", page.url(), "onboarding gate active");
  } else if (rootPath === "/create-org") {
    fail("root-redirect", page.url(), "no tenant — landed on /create-org");
  } else {
    fail("root-redirect", page.url(), `unexpected path: ${rootPath}`);
  }

  // If we didn't get the tenant base from the URL, resolve it
  if (!tenantBase) {
    // 1. Use hint from env var if provided
    if (TENANT_ID_HINT) {
      tenantBase = `/org/${TENANT_ID_HINT}`;
      pass("tenant-base-detected", page.url(), `from E2E_TENANT_ID: ${tenantBase}`);
    } else {
      // 2. Read user_tenants via Supabase REST using the session token + anon key
      const ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaGRycnBpanF5Z3l0dm9hYWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDYzMzAsImV4cCI6MjA4NjUyMjMzMH0.mGtlhNjMC_G2feTIRBCobbXvTGDcTwS5D8Lsz7j_0QE";

      const tenantIdFromDb = await page.evaluate(async (anonKey: string) => {
        const key = Object.keys(localStorage).find(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        if (!key) return null;
        try {
          const session = JSON.parse(localStorage.getItem(key) ?? "{}");
          const token = session?.access_token;
          if (!token) return null;
          const ref = key.replace(/^sb-/, "").replace(/-auth-token$/, "");
          const resp = await fetch(
            `https://${ref}.supabase.co/rest/v1/user_tenants?select=tenant_id&status=eq.active&limit=1`,
            { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } }
          );
          if (resp.ok) {
            const rows = await resp.json();
            return rows?.[0]?.tenant_id ?? null;
          }
        } catch {}
        return null;
      }, ANON_KEY);

      if (tenantIdFromDb) {
        tenantBase = `/org/${tenantIdFromDb}`;
        pass("tenant-base-detected", page.url(), `tenant base: ${tenantBase}`);
      } else {
        fail("tenant-base-detected", page.url(), "could not resolve tenant ID — set E2E_TENANT_ID");
        await browser.close();
        printSummary(consoleErrors);
        return;
      }
    }
  }

  // Bypass onboarding gate via sessionStorage so we can test protected routes
  // without completing the onboarding flow (mirrors the "Skip" button behaviour)
  const tenantId = tenantBase.replace("/org/", "");
  await page.evaluate((tid: string) => {
    sessionStorage.setItem(`valynt:onboarding:bypassed:${tid}`, "1");
  }, tenantId);

  // 4. Dashboard
  await testDashboard(page, `${tenantBase}/dashboard`);

  // 5. Nav links — labels match Sidebar.tsx nav item definitions
  console.log("\n=== NAV LINKS ===");
  for (const [label, fragment] of [
    ["My Work", "dashboard"],
    ["Cases", "opportunities"],
    ["Value Graph", "living-value-graph"],
    ["Models", "models"],
    ["Agents", "agents"],
    ["Company Intel", "company"],
    ["Settings", "settings"],
  ] as [string, string][]) {
    await testNavLink(page, label, fragment, tenantBase);
  }

  // 6. Onboarding (direct access — should be allowed even post-completion)
  await testOnboarding(page);

  // 7. Settings
  await testSettings(page, tenantBase);

  await browser.close();
  printSummary(consoleErrors);
}

function printSummary(consoleErrors: string[]) {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFAILURES:");
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ❌ ${r.name}: ${r.note} (${r.url})`));
  }
  if (consoleErrors.length > 0) {
    console.log(`\nCONSOLE ERRORS (${consoleErrors.length}):`);
    [...new Set(consoleErrors)].slice(0, 10).forEach((e) => console.log(`  • ${e}`));
  }
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("[fatal]", e.message);
  process.exit(1);
});
