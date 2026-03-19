import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const artifactDir = path.join(rootDir, "artifacts/branding");
const playwrightJsonPath = path.join(artifactDir, "tenant-branding-playwright-report.json");
const screenshotPath = path.join(artifactDir, "tenant-branding-preview.png");
const summaryJsonPath = path.join(artifactDir, "tenant-branding-summary.json");
const summaryMdPath = path.join(artifactDir, "tenant-branding-summary.md");

mkdirSync(artifactDir, { recursive: true });

const run = (label, command, args, extraEnv = {}) => {
  console.log(`\n[tenant-branding] ${label}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
};

try {
  run(
    "Run OrganizationGeneral branding unit test",
    "pnpm",
    [
      "--filter",
      "./apps/ValyntApp",
      "exec",
      "vitest",
      "run",
      "src/views/Settings/OrganizationGeneral.branding.test.tsx",
    ]
  );

  run(
    "Run tenant branding Playwright verification",
    "pnpm",
    [
      "--filter",
      "./apps/ValyntApp",
      "exec",
      "playwright",
      "test",
      "e2e/tenant-branding-render.spec.ts",
      "--reporter=line,json",
    ],
    {
      BRANDING_ARTIFACT_DIR: artifactDir,
      PLAYWRIGHT_JSON_OUTPUT_NAME: playwrightJsonPath,
    }
  );

  if (!existsSync(playwrightJsonPath)) {
    throw new Error(`Missing Playwright JSON report at ${playwrightJsonPath}`);
  }

  if (!existsSync(screenshotPath)) {
    throw new Error(`Missing tenant branding screenshot at ${screenshotPath}`);
  }

  const screenshotStats = statSync(screenshotPath);
  const summary = {
    status: "passed",
    verified_at_utc: new Date().toISOString(),
    screenshot: path.relative(rootDir, screenshotPath),
    screenshot_bytes: screenshotStats.size,
    playwright_report: path.relative(rootDir, playwrightJsonPath),
    checks: [
      "OrganizationGeneral renders tenant logo preview sourced from organization customBranding.logoUrl",
      "OrganizationGeneral renders tenant favicon preview sourced from organization customBranding.faviconUrl",
      "Primary and secondary tenant brand colors render on CTA + swatch surfaces",
      "A deterministic screenshot artifact is captured for release evidence",
    ],
  };

  writeFileSync(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(
    summaryMdPath,
    [
      "# Tenant Branding Render Verification",
      "",
      `- status: ${summary.status}`,
      `- verified_at_utc: ${summary.verified_at_utc}`,
      `- screenshot: ${summary.screenshot}`,
      `- screenshot_bytes: ${summary.screenshot_bytes}`,
      `- playwright_report: ${summary.playwright_report}`,
      "",
      "## Checks",
      ...summary.checks.map((check) => `- ${check}`),
      "",
    ].join("\n"),
    "utf8"
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(
    summaryJsonPath,
    `${JSON.stringify({ status: "failed", verified_at_utc: new Date().toISOString(), error: message }, null, 2)}\n`,
    "utf8"
  );
  writeFileSync(
    summaryMdPath,
    `# Tenant Branding Render Verification\n\n- status: failed\n- error: ${message}\n`,
    "utf8"
  );
  console.error(`[tenant-branding] ${message}`);
  process.exit(1);
}
