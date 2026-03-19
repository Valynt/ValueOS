import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  TENANT_BRANDING_FIXTURE,
  TENANT_BRANDING_FIXTURE_DOMAIN,
  TENANT_BRANDING_FIXTURE_NAME,
} from "../src/views/Settings/tenantBrandingFixture";

const BRANDING_ARTIFACT_DIR = process.env.BRANDING_ARTIFACT_DIR ?? path.resolve("test-results/branding");

const ensureArtifactDir = () => {
  fs.mkdirSync(BRANDING_ARTIFACT_DIR, { recursive: true });
};

test("renders tenant branding assets in organization settings preview surfaces", async ({ page }) => {
  ensureArtifactDir();

  await page.goto("/__playwright__/branding-preview");
  await expect(page.getByText(TENANT_BRANDING_FIXTURE_NAME)).toBeVisible();
  await expect(page.getByText(TENANT_BRANDING_FIXTURE_DOMAIN)).toBeVisible();

  const logo = page.getByTestId("tenant-branding-logo");
  await expect(logo).toBeVisible();
  const logoDimensions = await logo.evaluate((node) => {
    const image = node as HTMLImageElement;
    return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  });
  expect(logoDimensions.naturalWidth).toBeGreaterThan(0);
  expect(logoDimensions.naturalHeight).toBeGreaterThan(0);

  const favicon = page.getByTestId("tenant-branding-favicon");
  await expect(favicon).toBeVisible();
  const faviconDimensions = await favicon.evaluate((node) => {
    const image = node as HTMLImageElement;
    return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
  });
  expect(faviconDimensions.naturalWidth).toBeGreaterThan(0);
  expect(faviconDimensions.naturalHeight).toBeGreaterThan(0);

  await expect(page.getByTestId("tenant-branding-primary-action")).toHaveCSS(
    "background-color",
    "rgb(15, 118, 110)"
  );
  await expect(page.getByTestId("tenant-branding-secondary-action")).toHaveCSS(
    "background-color",
    "rgb(29, 78, 216)"
  );
  await expect(page.getByTestId("tenant-branding-primary-swatch")).toHaveCSS(
    "background-color",
    "rgb(15, 118, 110)"
  );
  await expect(page.getByTestId("tenant-branding-secondary-swatch")).toHaveCSS(
    "background-color",
    "rgb(29, 78, 216)"
  );

  expect(TENANT_BRANDING_FIXTURE.logoUrl).toBeTruthy();
  expect(TENANT_BRANDING_FIXTURE.faviconUrl).toBeTruthy();

  await page.screenshot({
    path: path.join(BRANDING_ARTIFACT_DIR, "tenant-branding-preview.png"),
    fullPage: true,
  });
});
