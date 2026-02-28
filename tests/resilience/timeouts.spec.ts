import { expect, test } from "@playwright/test";

test.describe("AgentChatInterface Resilience: Timeouts", () => {
  test("Should display Retry Interface after 30s LLM timeout", async ({
    page,
  }) => {
    // 1. Intercept the LLM Generate call and delay response beyond 30s
    await page.route("/api/v1/llm/generate", async (route) => {
      // Delay for 31 seconds to exceed the TIMEOUT_MS defined in AgentQueryService.ts
      await new Promise((resolve) => setTimeout(resolve, 31000));
      // Start with abort if possible or fulfill with error, but abort is cleaner for timeout simulation if client cancels
      // However, usually the server times out or client times out.
      // User prompt used await route.abort('timedout');
      await route.abort("timedout");
    });

    await page.goto("/agent/chat");

    // 2. Submit a message to trigger the request
    await page.fill('textarea[placeholder*="Ask"]', "Generate value report");
    await page.keyboard.press("Enter");

    // 3. Verify the Loading Skeleton appears first (UX Check)
    await expect(page.locator(".animate-pulse")).toBeVisible();

    // 4. Verify Timeout UI appears (set timeout for the test to wait at least 31s)
    const retryButton = page.getByRole("button", { name: /Retry Interface/i });
    await expect(retryButton).toBeVisible({ timeout: 35000 });

    await expect(
      page.locator("text=The request timed out after 30 seconds.")
    ).toBeVisible();
  });

  test("Circuit Breaker: Should block requests when error rate > 5%", async ({
    page,
  }) => {
    // Simulate a tripped Circuit Breaker (503 Service Unavailable)
    await page.route("/api/v1/llm/generate", async (route) => {
      await route.fulfill({
        status: 503,
        body: JSON.stringify({ error: "Circuit Open", code: "CIRCUIT_OPEN" }),
      });
    });

    await page.goto("/agent/chat");
    await page.fill("textarea", "Test Circuit Breaker");
    await page.keyboard.press("Enter");

    // Verify the "Service Temporarily Unavailable" UI with cooldown
    await expect(
      page.locator("text=Service Temporarily Unavailable")
    ).toBeVisible();
  });
});
