import { expect, test } from "@playwright/test";

test.describe("Scalekit Authentication Flow", () => {
  test("should redirect to Scalekit from the dedicated login page", async ({
    page,
  }) => {
    // 1. Navigate to the newly implemented Scalekit login route
    console.log("Navigating to /a/auth/login...");
    await page.goto("/a/auth/login");

    // 2. Verify we see the transition UI
    await expect(page.getByText("Enterprise Access")).toBeVisible();
    await expect(
      page.getByText("Establishing a secure connection")
    ).toBeVisible();

    // 3. Wait for the redirection to the Scalekit Environment
    // We expect the URL to eventually contain 'scalekit.dev' or the specific environment URL
    console.log("Waiting for redirection to Scalekit...");

    // Note: We use a regex to match the OAuth authorize endpoint on Scalekit
    await page.waitForURL(/.*scalekit\.dev\/oauth\/authorize.*/, {
      timeout: 10000,
    });

    const currentUrl = page.url();
    console.log("Final URL:", currentUrl);

    // 4. Assert that we reached the correct destination
    expect(currentUrl).toContain("valynt.scalekit.dev");
    expect(currentUrl).toContain("client_id=");
    expect(currentUrl).toContain("response_type=code");

    console.log(
      "Successfully proofed: /a/auth/login redirects to Scalekit correctly."
    );
  });

  test("sign in button on main login page should also redirect to scalekit", async ({
    page,
  }) => {
    // 1. Go to main login page
    await page.goto("/login");

    // 2. Find and click the Enterprise SSO button
    const ssoButton = page.getByRole("button", {
      name: /Sign in with Enterprise SSO/i,
    });
    await expect(ssoButton).toBeVisible();

    console.log("Clicking Enterprise SSO button...");
    await ssoButton.click();

    // 3. Verify redirection
    await page.waitForURL(/.*scalekit\.dev\/oauth\/authorize.*/, {
      timeout: 10000,
    });

    expect(page.url()).toContain("valynt.scalekit.dev");
    console.log(
      'Successfully proofed: "Sign in with Enterprise SSO" button works.'
    );
  });
});
