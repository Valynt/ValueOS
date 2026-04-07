# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\value-case-workflows.spec.ts >> Value Case Workflows >> TEST-VC-001: Sign in and land in the right place
- Location: tests\e2e\value-case-workflows.spec.ts:37:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/work" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - main [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]:
          - generic [ref=e9]:
            - generic [ref=e11]: VALYNT
            - generic [ref=e12]:
              - generic [ref=e13]: Economic Intelligence
              - heading "Decipher the economic value of your business." [level=2] [ref=e14]:
                - text: Decipher the
                - text: economic value of your business.
              - paragraph [ref=e15]: Quantify impact with our Living Value Model. Designed for boardroom confidence, not dashboards.
          - generic [ref=e16]:
            - generic [ref=e18]:
              - generic [ref=e20]: account_balance
              - img
              - generic [ref=e21]:
                - generic [ref=e24]: Revenue
                - generic [ref=e27]: Cost
                - generic [ref=e30]: Risk
            - paragraph [ref=e31]: Data signals unified into real-time financial outcomes.
        - generic [ref=e36]:
          - generic [ref=e37]:
            - heading "Welcome back" [level=3] [ref=e38]
            - paragraph [ref=e39]: Continue building your value case.
          - alert [ref=e40]: Invalid credentials
          - generic [ref=e41]:
            - generic [ref=e42]:
              - text: Corporate Email
              - textbox "Corporate Email" [ref=e43]:
                - /placeholder: executive@company.com
                - text: test.executive@example.com
            - generic [ref=e44]:
              - generic [ref=e45]:
                - generic [ref=e46]: Security Key
                - link "Forgot key?" [ref=e47] [cursor=pointer]:
                  - /url: /reset-password
              - generic [ref=e48]:
                - textbox "Security Key" [ref=e49]:
                  - /placeholder: ••••••••
                  - text: SecureTestPass123!@#
                - button "Show password" [ref=e50] [cursor=pointer]:
                  - generic [ref=e51]: visibility
            - generic [ref=e52]:
              - checkbox "Secure session persistence" [ref=e53]
              - generic [ref=e54]: Secure session persistence
            - button "Resume Value Model" [ref=e55] [cursor=pointer]
          - generic [ref=e56]: Enterprise Authentication
          - generic [ref=e59]:
            - button "Google Workspace" [ref=e60] [cursor=pointer]:
              - img [ref=e61]
              - generic [ref=e66]: Google Workspace
            - button "Okta SSO" [ref=e67] [cursor=pointer]:
              - generic [ref=e68]: corporate_fare
              - generic [ref=e69]: Okta SSO
          - paragraph [ref=e71]:
            - text: New partner?
            - link "Request access" [ref=e72] [cursor=pointer]:
              - /url: /signup
    - generic [ref=e74]:
      - generic [ref=e76]: query_stats
      - generic [ref=e77]:
        - generic [ref=e80]: Network Integrity
        - paragraph [ref=e81]: "Economic Engine: Synchronized"
  - button "Send beta feedback" [ref=e82] [cursor=pointer]:
    - img
    - text: Beta Feedback
```

# Test source

```ts
  1   | /**
  2   |  * Value Case Workflows E2E Tests
  3   |  * 
  4   |  * Comprehensive test suite covering the 10 core user scenarios for ValueOS.
  5   |  * Tests are designed to fail initially if the application is not working as intended,
  6   |  * ensuring that a 100% pass rate means the application is 100% healthy.
  7   |  * 
  8   |  * Run with: npx playwright test tests/e2e/value-case-workflows.spec.ts
  9   |  */
  10  | import { expect, test } from "@playwright/test";
  11  | 
  12  | // Test data
  13  | const testUser = {
  14  |   email: "test.executive@example.com",
  15  |   password: "SecureTestPass123!@#",
  16  | };
  17  | 
  18  | test.describe("Value Case Workflows", () => {
  19  |   // Use serial mode since some tests build on the state of previous ones (like creating a case)
  20  |   test.describe.configure({ mode: "serial" });
  21  | 
  22  |   let caseUrl: string;
  23  | 
  24  |   test.beforeEach(async ({ page }) => {
  25  |     // Navigate to login page
  26  |     await page.goto("/login");
  27  |     
  28  |     // Login using the ModernLoginPage selectors
  29  |     await page.fill('input[name="email"]', testUser.email);
  30  |     await page.fill('input[name="password"]', testUser.password);
  31  |     await page.click('button[type="submit"]');
  32  |     
  33  |     // Wait for dashboard/home
> 34  |     await page.waitForURL("**/work", { timeout: 15000 });
      |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  35  |   });
  36  | 
  37  |   test("TEST-VC-001: Sign in and land in the right place", async ({ page }) => {
  38  |     // Test that a user can open the app, authenticate, and land on the correct first screen
  39  |     // for their role without broken redirects, blank states, or console errors.
  40  |     
  41  |     // 1. Verify landing on correct first screen (Home/Dashboard)
  42  |     await expect(page).toHaveURL(/.*\/work/);
  43  |     
  44  |     // 2. Verify no blank states
  45  |     const sidebar = page.locator('nav[aria-label="Main navigation"]');
  46  |     await expect(sidebar).toBeVisible();
  47  |     
  48  |     // Verify key navigation items are present
  49  |     await expect(page.locator('a[href*="work"]').first()).toBeVisible();
  50  |     await expect(page.locator('a[href*="work/cases"]').first()).toBeVisible();
  51  |     
  52  |     // 3. Check for console errors
  53  |     const errors: string[] = [];
  54  |     page.on("pageerror", (err) => errors.push(err.message));
  55  |     page.on("console", (msg) => {
  56  |       if (msg.type() === "error") errors.push(msg.text());
  57  |     });
  58  |     
  59  |     // Wait a moment to catch any asynchronous rendering errors
  60  |     await page.waitForTimeout(2000);
  61  |     
  62  |     // Assert no critical errors occurred during load
  63  |     expect(errors.filter(e => !e.includes('favicon') && !e.includes('404'))).toHaveLength(0);
  64  |   });
  65  | 
  66  |   test("TEST-VC-002: Create a new value case from scratch", async ({ page }) => {
  67  |     // Test that a user can start a new workflow, enter core opportunity or account details,
  68  |     // save progress, and clearly understand what happens next.
  69  |     
  70  |     // 1. Navigate to Opportunities/Cases
  71  |     await page.goto("/work/cases");
  72  |     
  73  |     // 2. Start new workflow
  74  |     const companyInput = page.locator('input[placeholder*="Acme Corp"]');
  75  |     await expect(companyInput).toBeVisible();
  76  |     
  77  |     const testCompanyName = `Test Company ${Date.now()}`;
  78  |     await companyInput.fill(testCompanyName);
  79  |     
  80  |     // Select domain pack if available
  81  |     const packSelect = page.locator('select');
  82  |     if (await packSelect.isVisible()) {
  83  |       // Try to select the first actual pack (index 1, as 0 is usually "No Domain Pack")
  84  |       const options = await packSelect.locator('option').count();
  85  |       if (options > 1) {
  86  |         await packSelect.selectOption({ index: 1 });
  87  |       }
  88  |     }
  89  |     
  90  |     // 3. Submit
  91  |     await page.keyboard.press("Enter");
  92  |     
  93  |     // 4. Verify navigation to canvas
  94  |     await page.waitForURL(/.*\/opportunities\/.*\/cases\/.*/, { timeout: 20000 });
  95  |     
  96  |     // Save the URL for subsequent tests
  97  |     caseUrl = page.url();
  98  |     
  99  |     // 5. Verify clear understanding of what happens next
  100 |     // Check for the guided next action or the active milestone
  101 |     const guidedAction = page.locator('[data-testid="guided-next-action"]');
  102 |     const activeMilestone = page.locator('text=/Journey milestone/i');
  103 |     
  104 |     // At least one form of guidance should be visible
  105 |     expect(await guidedAction.isVisible() || await activeMilestone.isVisible()).toBeTruthy();
  106 |     
  107 |     // Verify the company name is displayed in the header
  108 |     await expect(page.locator(`h2:has-text("${testCompanyName}")`).first()).toBeVisible();
  109 |   });
  110 | 
  111 |   test("TEST-VC-003: Use CRM-connected intake if integrations exist", async ({ page }) => {
  112 |     // Test that a user can import an opportunity or account from a connected source,
  113 |     // review the pulled data, fix bad mappings, and continue without confusion.
  114 |     
  115 |     // 1. Navigate to Settings -> Integrations
  116 |     await page.goto("/settings/integrations");
  117 |     
  118 |     // 2. Check if CRM is connected
  119 |     const isConnected = await page.locator('text=/Connected/i').count() > 0;
  120 |     
  121 |     if (isConnected) {
  122 |       // 3. Navigate to Opportunities
  123 |       await page.goto("/work/cases");
  124 |       
  125 |       // 4. Look for CRM import button (often in a modal or dropdown)
  126 |       // This might be a "Link Deal" or "Import" button
  127 |       const importBtn = page.locator('button:has-text("Import"), button:has-text("Link Deal")').first();
  128 |       
  129 |       if (await importBtn.isVisible()) {
  130 |         await importBtn.click();
  131 |         
  132 |         // 5. Search and select opportunity in the CRMSelector
  133 |         const searchInput = page.locator('input[type="search"], input[placeholder*="Search opportunities"]');
  134 |         await expect(searchInput).toBeVisible();
```