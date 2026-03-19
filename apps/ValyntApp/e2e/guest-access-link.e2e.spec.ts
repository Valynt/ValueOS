import { expect, test } from "@playwright/test";

test.describe("guest access magic-link flow", () => {
  test("valid link lands on the guest page", async ({ page }) => {
    await page.route("**/rest/v1/rpc/validate_guest_token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            is_valid: true,
            value_case_id: "case-123",
            permissions: { can_view: true, can_comment: false, can_edit: false },
            guest_name: "Jordan Guest",
            guest_email: "jordan@example.com",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        ]),
      });
    });

    await page.goto("/guest/access?token=valid-token");

    await expect(page.getByText("Guest Value Calculator")).toBeVisible();
  });

  test("invalid or expired links show the failure shell", async ({ page }) => {
    await page.route("**/rest/v1/rpc/validate_guest_token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            is_valid: false,
            error_message: "Token has expired",
          },
        ]),
      });
    });

    await page.goto("/guest/access?token=expired-token");

    await expect(page.getByText("Link Expired")).toBeVisible();
    await expect(page.getByText("This access link has expired. Please request a new one.")).toBeVisible();
  });
});
