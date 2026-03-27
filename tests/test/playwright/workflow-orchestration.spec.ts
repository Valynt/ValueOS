import { expect, test } from "@playwright/test";

const TIMEOUTS = { navigation: 20000, ui: 6000 };

async function waitForAppLoad(page) {
  await page.goto("/");
  await page.waitForSelector("#root > *", { timeout: TIMEOUTS.navigation });
  await page.waitForTimeout(500);
}

test.describe("Workflow orchestration UI", () => {
  test("create case and start orchestration shows workflow status", async ({
    page,
  }) => {
    await waitForAppLoad(page);

    const newCaseButton = page
      .getByRole("button", { name: /new case|new chat/i })
      .first();
    await expect(newCaseButton, "Expected a visible New case entry point in orchestration UI").toBeVisible({ timeout: TIMEOUTS.ui });
    await newCaseButton.click();

    const companyInput = page.getByLabel(/company name/i);
    await companyInput.fill("Playwright Orchestration Co");
    const createBtn = page.getByRole("button", { name: /create case/i });
    await createBtn.click();

    await expect(page.getByText(/Playwright Orchestration Co/i)).toBeVisible({
      timeout: TIMEOUTS.ui,
    });

    // Try to start a workflow from the UI (common hook/button text)
    const startWorkflow = page
      .getByRole("button", {
        name: /start workflow|run orchestration|execute workflow/i,
      })
      .first();
    await expect(startWorkflow, "Expected visible workflow start control").toBeVisible({ timeout: TIMEOUTS.ui });
    await startWorkflow.click();

    // Expect a notification or workflow state change element
    const successIndicator = page.getByText(
      /workflow started|orchestration started|execution started/i,
    );
    if (!(await successIndicator.isVisible().catch(() => false))) {
      // Heuristic: look for workflow entry in UI
      const workflowBadge = page.getByText(/status:|running|started/i).first();
      await expect(workflowBadge).toBeVisible({ timeout: TIMEOUTS.ui });
    } else {
      await expect(successIndicator).toBeVisible({ timeout: TIMEOUTS.ui });
    }
  });
});
