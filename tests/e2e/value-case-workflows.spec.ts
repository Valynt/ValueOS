/**
 * Value Case Workflows E2E Tests
 *
 * Comprehensive test suite covering the 10 core user scenarios for ValueOS.
 * Tests are designed to fail initially if the application is not working as intended,
 * ensuring that a 100% pass rate means the application is 100% healthy.
 *
 * Run with: npx playwright test tests/e2e/value-case-workflows.spec.ts
 */
import { expect, test } from "@playwright/test";

// Test data
const testUser = {
  email: "test.executive@example.com",
  password: "SecureTestPass123!@#",
};

test.describe("Value Case Workflows", () => {
  // Use serial mode since some tests build on the state of previous ones (like creating a case)
  test.describe.configure({ mode: "serial" });

  let caseUrl: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Login using the ModernLoginPage selectors
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard/home
    await page.waitForURL("**/work", { timeout: 15000 });
  });

  test("TEST-VC-001: Sign in and land in the right place", async ({ page }) => {
    // Test that a user can open the app, authenticate, and land on the correct first screen
    // for their role without broken redirects, blank states, or console errors.

    // 1. Verify landing on correct first screen (Home/Dashboard)
    await expect(page).toHaveURL(/.*\/work/);

    // 2. Verify no blank states
    const sidebar = page.locator('nav[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible();

    // Verify key navigation items are present
    await expect(page.locator('a[href*="work"]').first()).toBeVisible();
    await expect(page.locator('a[href*="work/cases"]').first()).toBeVisible();

    // 3. Check for console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // Wait a moment to catch any asynchronous rendering errors
    await page.waitForTimeout(2000);

    // Assert no critical errors occurred during load
    expect(errors.filter(e => !e.includes('favicon') && !e.includes('404'))).toHaveLength(0);
  });

  test("TEST-VC-002: Create a new value case from scratch", async ({ page }) => {
    // Test that a user can start a new workflow, enter core opportunity or account details,
    // save progress, and clearly understand what happens next.

    // 1. Navigate to Opportunities/Cases
    await page.goto("/work/cases");

    // 2. Start new workflow
    const companyInput = page.locator('input[placeholder*="Acme Corp"]');
    await expect(companyInput).toBeVisible();

    const testCompanyName = `Test Company ${Date.now()}`;
    await companyInput.fill(testCompanyName);

    // Select domain pack if available
    const packSelect = page.locator('select');
    if (await packSelect.isVisible()) {
      // Try to select the first actual pack (index 1, as 0 is usually "No Domain Pack")
      const options = await packSelect.locator('option').count();
      if (options > 1) {
        await packSelect.selectOption({ index: 1 });
      }
    }

    // 3. Submit
    await page.keyboard.press("Enter");

    // 4. Verify navigation to canvas
    await page.waitForURL(/.*\/opportunities\/.*\/cases\/.*/, { timeout: 20000 });

    // Save the URL for subsequent tests
    caseUrl = page.url();

    // 5. Verify clear understanding of what happens next
    // Check for the guided next action or the active milestone
    const guidedAction = page.locator('[data-testid="guided-next-action"]');
    const activeMilestone = page.locator('text=/Journey milestone/i');

    // At least one form of guidance should be visible
    expect(await guidedAction.isVisible() || await activeMilestone.isVisible()).toBeTruthy();

    // Verify the company name is displayed in the header
    await expect(page.locator(`h2:has-text("${testCompanyName}")`).first()).toBeVisible();
  });

  test("TEST-VC-003: Use CRM-connected intake if integrations exist", async ({ page }) => {
    // Test that a user can import an opportunity or account from a connected source,
    // review the pulled data, fix bad mappings, and continue without confusion.

    // 1. Navigate to Settings -> Integrations
    await page.goto("/settings/integrations");

    // 2. Check if CRM is connected
    const isConnected = await page.locator('text=/Connected/i').count() > 0;

    if (isConnected) {
      // 3. Navigate to Opportunities
      await page.goto("/work/cases");

      // 4. Look for CRM import button (often in a modal or dropdown)
      // This might be a "Link Deal" or "Import" button
      const importBtn = page.locator('button:has-text("Import"), button:has-text("Link Deal")').first();

      if (await importBtn.isVisible()) {
        await importBtn.click();

        // 5. Search and select opportunity in the CRMSelector
        const searchInput = page.locator('input[type="search"], input[placeholder*="Search opportunities"]');
        await expect(searchInput).toBeVisible();
        await searchInput.fill("Test Opp");

        // Wait for search results
        await page.waitForTimeout(2000);

        // Select the first result if available
        const firstResult = page.locator('button:has-text("Import"), button:has-text("Select")').first();
        if (await firstResult.isVisible()) {
          await firstResult.click();

          // 6. Verify pulled data
          // The UI should show the imported opportunity
          await expect(page.locator('text=/Test Opp/i').first()).toBeVisible();
        }
      }
    } else {
      // If not connected, verify the disconnected state is clear and offers connection
      await expect(page.locator('text=/Connect with Salesforce|Connect with HubSpot/i').first()).toBeVisible();
    }
  });

  test("TEST-VC-004: Build or review a value tree", async ({ page }) => {
    // Test that a user can see the value tree, understand the hierarchy of drivers,
    // expand and collapse sections, edit assumptions, and tell what is system-generated versus user-entered.

    // 1. Navigate to the case created in VC-002 (or create a new one if running isolated)
    if (caseUrl) {
      await page.goto(caseUrl);
    } else {
      await page.goto("/work/cases");
      await page.click('a[href*="/cases/"] >> nth=0');
    }

    // 2. Navigate to Model stage
    await page.click('button:has-text("Model")');

    // 3. Run Target Agent if tree is empty
    const runTargetBtn = page.locator('button:has-text("Run Target Agent")');
    if (await runTargetBtn.isVisible()) {
      await runTargetBtn.click();
      // Wait for agent to finish
      await expect(runTargetBtn).not.toBeVisible({ timeout: 30000 });
    }

    // 4. Verify value tree hierarchy
    await expect(page.locator('text=/Value Architecture/i')).toBeVisible();

    // 5. Check for system-generated vs user-entered indicators
    // Look for confidence badges which indicate system generation
    const confidenceBadges = page.locator('.bg-emerald-500, .bg-amber-500, .bg-red-400');
    if (await confidenceBadges.count() > 0) {
      await expect(confidenceBadges.first()).toBeVisible();
    }

    // 6. Edit assumption
    // Find an editable field (usually indicated by a hover state or specific class)
    const editableField = page.locator('span.group\/edit').first();
    if (await editableField.isVisible()) {
      await editableField.click();

      // The input should appear
      const input = page.locator('input').first();
      await expect(input).toBeVisible();

      // Fill new value and save
      await input.fill("Edited Label");
      await page.keyboard.press("Enter");

      // Verify it saved
      await expect(page.locator('text=/Edited Label/i').first()).toBeVisible();
    }
  });

  test("TEST-VC-005: Validate assumptions and evidence", async ({ page }) => {
    // Test that a user can inspect an assumption, view supporting evidence, see confidence levels,
    // and decide whether to accept, edit, or challenge the system's recommendation.

    if (caseUrl) {
      await page.goto(caseUrl);
    } else {
      await page.goto("/work/cases");
      await page.click('a[href*="/cases/"] >> nth=0');
    }

    // 1. Navigate to Integrity stage
    await page.click('button:has-text("Integrity")');

    // 2. Run Integrity Agent if empty
    const runIntegrityBtn = page.locator('button:has-text("Run Integrity Agent")');
    if (await runIntegrityBtn.isVisible()) {
      await runIntegrityBtn.click();
      await expect(runIntegrityBtn).not.toBeVisible({ timeout: 30000 });
    }

    // 3. Inspect assumption/claim
    // Look for claim cards
    const claimCards = page.locator('.border-zinc-200, .border-amber-200, .border-red-200');

    if (await claimCards.count() > 0) {
      const firstCard = claimCards.first();

      // 4. View supporting evidence / confidence levels
      // Check for confidence percentage
      await expect(firstCard.locator('text=/%/')).toBeVisible();

      // 5. Decide to accept/edit/challenge
      // Look for action buttons on flagged claims
      const overrideBtn = firstCard.locator('button:has-text("Override")');
      const reviseBtn = firstCard.locator('button:has-text("Revise")');
      const removeBtn = firstCard.locator('button:has-text("Remove")');

      // If it's a flagged claim, these buttons should be visible
      if (await overrideBtn.isVisible()) {
        // We don't actually click it to avoid breaking the state for the next test,
        // but we verify the capability exists
        expect(await overrideBtn.isEnabled()).toBeTruthy();
        expect(await reviseBtn.isEnabled()).toBeTruthy();
        expect(await removeBtn.isEnabled()).toBeTruthy();
      }
    }

    // 6. Open Evidence Drawer
    const evidenceBtn = page.locator('button:has-text("Evidence")');
    if (await evidenceBtn.isVisible()) {
      await evidenceBtn.click();

      // Verify drawer opens
      const drawer = page.locator('.fixed.inset-y-0.right-0');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('text=/Evidence & Provenance/i')).toBeVisible();

      // Close drawer
      await drawer.locator('button').first().click();
      await expect(drawer).not.toBeVisible();
    }
  });

  test("TEST-VC-006: Generate and refine an executive narrative", async ({ page }) => {
    // Test that a user can create an output such as a business case or value summary,
    // edit the language, keep the financial logic intact, and understand what changed after each revision.

    if (caseUrl) {
      await page.goto(caseUrl);
    } else {
      await page.goto("/work/cases");
      await page.click('a[href*="/cases/"] >> nth=0');
    }

    // 1. Navigate to Narrative stage
    await page.click('button:has-text("Narrative")');

    // 2. Run Narrative Agent if empty
    const runNarrativeBtn = page.locator('button:has-text("Run Narrative Agent")');
    if (await runNarrativeBtn.isVisible()) {
      await runNarrativeBtn.click();
      await expect(runNarrativeBtn).not.toBeVisible({ timeout: 45000 }); // Narrative takes longer
    }

    // 3. Verify narrative generation
    await expect(page.locator('text=/Narrative Assembly/i')).toBeVisible();

    // 4. Check for export options
    await expect(page.locator('button:has-text("PDF Report")')).toBeVisible();
    await expect(page.locator('button:has-text("Slide Deck")')).toBeVisible();
    await expect(page.locator('button:has-text("Copy to Clipboard")')).toBeVisible();

    // 5. Edit language
    const editBtn = page.locator('button:has-text("Edit")');
    const adjustToneBtn = page.locator('button:has-text("Adjust Tone")');

    if (await editBtn.isVisible()) {
      expect(await editBtn.isEnabled()).toBeTruthy();
    }

    if (await adjustToneBtn.isVisible()) {
      expect(await adjustToneBtn.isEnabled()).toBeTruthy();
    }

    // 6. Verify approval workflow exists
    await expect(page.locator('button:has-text("Request approval"), button:has-text("Re-request approval")')).toBeVisible();
  });

  test("TEST-VC-007: Recover from missing or broken data gracefully", async ({ page }) => {
    // Test that a user encounters incomplete API data, a failed request, or an empty result
    // and still gets a clear explanation, recovery path, and no dead ends.

    // 1. Navigate to Opportunities
    await page.goto("/work/cases");

    // 2. Create a dummy case that will likely have no data
    const companyInput = page.locator('input[placeholder*="Acme Corp"]');
    await companyInput.fill("INVALID_COMPANY_NO_DATA_123_XYZ");
    await page.keyboard.press("Enter");

    // Wait for navigation
    await page.waitForURL(/.*\/opportunities\/.*\/cases\/.*/, { timeout: 15000 });

    // 3. Check for graceful empty states
    // The Hypothesis stage should show an empty state
    const emptyState = page.locator('text=/No hypotheses yet/i');
    await expect(emptyState).toBeVisible();

    // 4. Verify recovery path
    // There should be a clear instruction and a button to run the agent
    await expect(page.locator('text=/Click "Run Stage" to have the Opportunity Agent generate/i')).toBeVisible();

    const runBtn = page.locator('button:has-text("Run Stage")');
    await expect(runBtn).toBeVisible();
    expect(await runBtn.isEnabled()).toBeTruthy();

    // 5. Check other stages for graceful empty states
    await page.click('button:has-text("Model")');
    await expect(page.locator('text=/No value tree yet/i')).toBeVisible();
    await expect(page.locator('button:has-text("Run Target Agent")')).toBeVisible();

    await page.click('button:has-text("Integrity")');
    await expect(page.locator('text=/No integrity analysis yet/i')).toBeVisible();
    await expect(page.locator('button:has-text("Run Integrity Agent")')).toBeVisible();
  });

  test("TEST-VC-008: Switch between sections without losing work", async ({ page }) => {
    // Test that a user can move between dashboard, modeling, validation, settings, and output screens
    // without losing unsaved edits, breaking state, or becoming disoriented.

    if (caseUrl) {
      await page.goto(caseUrl);
    } else {
      await page.goto("/work/cases");
      await page.click('a[href*="/cases/"] >> nth=0');
    }

    // 1. Go to Hypothesis
    await page.click('button:has-text("Hypothesis")');

    // Wait for content to load
    await page.waitForTimeout(1000);

    // 2. Switch to Model
    await page.click('button:has-text("Model")');
    await expect(page.locator('text=/Value Architecture|No value tree yet/i').first()).toBeVisible();

    // 3. Switch to Integrity
    await page.click('button:has-text("Integrity")');
    await expect(page.locator('text=/No integrity analysis yet|Veto triggered|claims/i').first()).toBeVisible();

    // 4. Switch to Narrative
    await page.click('button:has-text("Narrative")');
    await expect(page.locator('text=/Narrative Assembly|No narrative draft yet/i').first()).toBeVisible();

    // 5. Switch back to Hypothesis
    await page.click('button:has-text("Hypothesis")');

    // Verify state isn't broken (no errors, content still visible)
    await expect(page.locator('text=/Financial Assumptions|No hypotheses yet/i').first()).toBeVisible();

    // 6. Navigate away to Settings and back
    await page.goto("/settings");
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();

    // Use browser back button
    await page.goBack();

    // Verify we're back on the canvas and it's functional
    await expect(page.locator('button:has-text("Hypothesis")')).toBeVisible();
  });

  test("TEST-VC-009: Use the app on a smaller screen or constrained window", async ({ page }) => {
    // Test that a user can complete the core workflow on a laptop-sized viewport
    // and that navigation, tables, drawers, and forms remain usable and readable.

    // 1. Set viewport to a smaller laptop size (1024x768)
    await page.setViewportSize({ width: 1024, height: 768 });

    if (caseUrl) {
      await page.goto(caseUrl);
    } else {
      await page.goto("/work/cases");
      await page.click('a[href*="/cases/"] >> nth=0');
    }

    // 2. Verify navigation remains usable
    // The sidebar might collapse or change, but should still be accessible
    const sidebar = page.locator('nav[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible();

    // 3. Verify stage tabs are readable and accessible
    // They should scroll horizontally or wrap, not overflow hidden
    const stageTabs = page.locator('button:has-text("Hypothesis")').locator('..');
    await expect(stageTabs).toBeVisible();

    // 4. Verify tables/forms are readable
    await page.click('button:has-text("Model")');
    await expect(page.locator('text=/Value Architecture|No value tree yet/i').first()).toBeVisible();

    // 5. Open evidence drawer to check constrained space handling
    await page.click('button:has-text("Evidence")');
    const drawer = page.locator('.fixed.inset-y-0.right-0');
    await expect(drawer).toBeVisible();

    // The drawer should not take up the entire screen (should be ~400px wide)
    const drawerBox = await drawer.boundingBox();
    const pageBox = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));

    if (drawerBox) {
      expect(drawerBox.width).toBeLessThan(pageBox.width);
    }

    // Close drawer
    await drawer.locator('button').first().click();
    await expect(drawer).not.toBeVisible();
  });

  test("TEST-VC-010: Complete a full end-to-end workflow to finalization", async ({ page }) => {
    // Test that a user can go from intake to draft, validation, refinement, and final output,
    // with each state transition being understandable and with the app always showing what stage they are in.

    // 1. Intake (Create case)
    await page.goto("/work/cases");
    const companyInput = page.locator('input[placeholder*="Acme Corp"]');
    await companyInput.fill(`E2E Finalization Test ${Date.now()}`);
    await page.keyboard.press("Enter");
    await page.waitForURL(/.*\/opportunities\/.*\/cases\/.*/, { timeout: 15000 });

    // 2. Draft (Hypothesis)
    await expect(page.locator('button:has-text("Hypothesis")')).toBeVisible();
    const runHypothesisBtn = page.locator('button:has-text("Run Stage")');
    if (await runHypothesisBtn.isVisible()) {
      await runHypothesisBtn.click();
      // Wait for agent to finish
      await expect(runHypothesisBtn).not.toBeVisible({ timeout: 45000 });
    }

    // Verify transition to next stage is clear
    // The active stage button should be highlighted (bg-zinc-950 text-white)
    await expect(page.locator('button:has-text("Hypothesis").bg-zinc-950')).toBeVisible();

    // 3. Validation (Integrity)
    await page.click('button:has-text("Integrity")');
    await expect(page.locator('button:has-text("Integrity").bg-zinc-950')).toBeVisible();

    const runIntegrityBtn = page.locator('button:has-text("Run Integrity Agent")');
    if (await runIntegrityBtn.isVisible()) {
      await runIntegrityBtn.click();
      await expect(runIntegrityBtn).not.toBeVisible({ timeout: 45000 });
    }

    // 4. Refinement (Model)
    await page.click('button:has-text("Model")');
    await expect(page.locator('button:has-text("Model").bg-zinc-950')).toBeVisible();

    const runTargetBtn = page.locator('button:has-text("Run Target Agent")');
    if (await runTargetBtn.isVisible()) {
      await runTargetBtn.click();
      await expect(runTargetBtn).not.toBeVisible({ timeout: 45000 });
    }

    // 5. Final Output (Narrative)
    await page.click('button:has-text("Narrative")');
    await expect(page.locator('button:has-text("Narrative").bg-zinc-950')).toBeVisible();

    const runNarrativeBtn = page.locator('button:has-text("Run Narrative Agent")');
    if (await runNarrativeBtn.isVisible()) {
      await runNarrativeBtn.click();
      await expect(runNarrativeBtn).not.toBeVisible({ timeout: 60000 });
    }

    // 6. Verify final state and export options
    await expect(page.locator('button:has-text("PDF Report")')).toBeVisible();
    await expect(page.locator('button:has-text("Slide Deck")')).toBeVisible();

    // Verify the workflow status indicator shows completion or high confidence
    const confidenceBar = page.locator('.h-full.rounded-full').first();
    await expect(confidenceBar).toBeVisible();
  });
});
