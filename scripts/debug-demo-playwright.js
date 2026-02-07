const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs from the page
  page.on("console", (msg) => {
    console.log(`[page console] ${msg.type()}: ${msg.text()}`);
  });

  // Prepare a demo session object similar to AuthContext
  const demoSession = {
    access_token: "demo-access-token-not-for-production",
    refresh_token: "demo-refresh-token-not-for-production",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "demo-user-00000000-0000-0000-0000-000000000000",
      email: "demo@valuecanvas.dev",
      aud: "authenticated",
      role: "authenticated",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    storedAt: Date.now(),
    rotatedAt: Date.now(),
  };

  // Navigate to app
  await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });

  // Inject demo session into sessionStorage under the AuthContext key
  await page.evaluate((session) => {
    try {
      sessionStorage.setItem("vc_session_v2", JSON.stringify(session));
      console.log("demo session injected");
    } catch (e) {
      console.error("failed to inject demo session", e);
    }
  }, demoSession);

  // Reload so app picks up stored session
  await page.reload({ waitUntil: "networkidle" });

  // Wait a bit for client-side services to run and log
  await page.waitForTimeout(3000);

  // Optionally, try to click a "Enter Demo Mode" button if present
  try {
    const demoButton = await page.$("text=Enter Demo Mode");
    if (demoButton) {
      await demoButton.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    // ignore
  }

  // Give some time for ValueCaseService fetches
  await page.waitForTimeout(3000);

  await browser.close();
  console.log("playwright finished");
})();
