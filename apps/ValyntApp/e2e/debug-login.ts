import { chromium } from "@playwright/test";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("[fatal] E2E_EMAIL and E2E_PASSWORD must be set");
  process.exit(1);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  await context.route("wss://**", (r) => r.abort());
  await context.route("**/api/analytics/**", (r) => r.abort());

  const page = await context.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("session") || text.includes("tenant") || text.includes("provision") || text.includes("Optimistic") || text.includes("clearing") || text.includes("401") || text.includes("403"))
      console.log(`[${msg.type()}] ${text.slice(0, 300)}`);
  });
  page.on("request", (req) => {
    if (req.url().includes("/api/")) {
      const h = req.headers();
      console.log(`[req] ${req.method()} ${req.url().replace(BASE_URL,"")}`);
      if (h["authorization"]) console.log(`  auth: ${h["authorization"].slice(0,50)}...`);
    }
  });
  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      let b = ""; try { b = await res.text(); } catch {}
      console.log(`[res] ${res.status()} ${res.url().replace(BASE_URL,"")} | ${b.slice(0,200)}`);
    }
  });
  page.on("pageerror", (e) => {
    if (!e.message.includes("wss://") && !e.message.includes("WebSocket"))
      console.log(`[pageerror] ${e.message.slice(0,200)}`);
  });

  // Login
  console.log("=== LOGIN ===");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', EMAIL!);
  await page.fill('input[type="password"]', PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  console.log(`After login: ${page.url()}`);

  // Check localStorage for Supabase session
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log(`localStorage keys: ${JSON.stringify(lsKeys)}`);
  const sbKey = lsKeys.find(k => k.includes("supabase") || k.includes("auth"));
  if (sbKey) {
    const val = await page.evaluate((k) => localStorage.getItem(k), sbKey);
    console.log(`session key "${sbKey}": ${val?.slice(0,100)}...`);
  }

  // Navigate to create-org
  console.log("\n=== NAVIGATE TO /create-org ===");
  await page.goto(`${BASE_URL}/create-org`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  console.log(`URL after 3s: ${page.url()}`);

  // Check if form is visible
  const formVisible = await page.locator('input[type="text"]').isVisible().catch(() => false);
  console.log(`Form visible: ${formVisible}`);

  if (formVisible) {
    console.log("\n=== SUBMIT FORM ===");
    await page.fill('input[type="text"]', "Valynt Demo");
    await page.waitForTimeout(300);
    await page.locator('button[type="submit"]').click();
    await Promise.race([
      page.waitForURL((u) => !u.pathname.includes("/create-org"), { timeout: 60000 }),
      page.waitForTimeout(60000),
    ]);
    console.log(`Final URL: ${page.url()}`);
    const errs = await page.locator('[class*="red"],[class*="error"],[role="alert"]').allTextContents();
    if (errs.length) console.log(`Page errors: ${JSON.stringify(errs)}`);
  }

  await browser.close();
}
run().catch((e) => { console.error("[fatal]", e.message); process.exit(1); });
