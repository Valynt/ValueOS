import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const SNAPSHOT_DIR = path.resolve("artifacts/ui");

test.describe("UI snapshot capture", () => {
  test("captures app shell screenshot", async ({ page }) => {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

    const response = await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });
    expect(response?.status()).toBeLessThan(500);

    await expect(page.locator("#root")).toBeVisible();

    await page.screenshot({
      path: path.join(SNAPSHOT_DIR, "app-shell.png"),
      fullPage: true,
    });
  });
});
