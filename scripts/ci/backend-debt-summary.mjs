#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const backendRoot = path.join(repoRoot, "packages", "backend");
const backendPackageJsonPath = path.join(backendRoot, "package.json");
const artifactsDir = path.join(repoRoot, "artifacts", "backend-debt");

const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, "utf8"));
const lintScript = String(backendPackageJson.scripts?.lint ?? "");
const lintWarningBaselineMatch = lintScript.match(/--max-warnings=(\d+)/);
const lintWarningBaseline = lintWarningBaselineMatch ? Number(lintWarningBaselineMatch[1]) : null;
const tsErrorBaseline = Number(backendPackageJson.tsErrorBaseline ?? 0);

function runCommand(command, cwd = repoRoot) {
  try {
    const stdout = execSync(command, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? ""),
    };
  }
}

function countBackendAny() {
  const sourceRoot = path.join(backendRoot, "src");
  const pattern = /:\s*any\b|as\s+any\b|<\s*any\s*>/;
  let total = 0;

  function walk(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(sourceRoot, fullPath).replaceAll(path.sep, "/");
      if (
        relativePath.includes("/__tests__/") ||
        relativePath.includes("/__benchmarks__/") ||
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".spec.ts") ||
        entry.name.endsWith(".d.ts")
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
        continue;
      }
      const lines = fs.readFileSync(fullPath, "utf8").split("\n");
      total += lines.filter((line) => pattern.test(line)).length;
    }
  }

  walk(sourceRoot);
  return total;
}

function countTypeScriptErrors() {
  const result = runCommand("pnpm exec tsc --noEmit --pretty false", repoRoot);
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  return {
    count: combinedOutput
      .split("\n")
      .filter((line) => /^packages\/backend\/.*error TS\d+:/.test(line.trim())).length,
    ok: result.ok,
  };
}

function countLintWarnings() {
  const outputPath = path.join(artifactsDir, "backend-eslint.json");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const result = runCommand(`pnpm exec eslint src/ -f json -o "${outputPath}"`, backendRoot);
  if (!fs.existsSync(outputPath)) {
    return { warnings: null, errors: null, ok: result.ok };
  }

  const report = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const warnings = report.reduce((sum, file) => sum + Number(file.warningCount ?? 0), 0);
  const errors = report.reduce((sum, file) => sum + Number(file.errorCount ?? 0), 0);
  return { warnings, errors, ok: result.ok };
}

const anyCount = countBackendAny();
const tsErrors = countTypeScriptErrors();
const lint = countLintWarnings();

const summary = {
  generatedAt: new Date().toISOString(),
  backendAnyCount: anyCount,
  tsErrors: {
    current: tsErrors.count,
    baseline: tsErrorBaseline,
    delta: tsErrors.count - tsErrorBaseline,
    commandSucceeded: tsErrors.ok,
  },
  lintWarnings: {
    current: lint.warnings,
    errors: lint.errors,
    baseline: lintWarningBaseline,
    delta:
      lint.warnings != null && lintWarningBaseline != null
        ? lint.warnings - lintWarningBaseline
        : null,
    commandSucceeded: lint.ok,
  },
};

const markdown = [
  "# Backend debt summary",
  "",
  `- Generated at: ${summary.generatedAt}`,
  `- Backend production \`any\` count: ${summary.backendAnyCount}`,
  `- Backend TypeScript errors: ${summary.tsErrors.current} (baseline: ${summary.tsErrors.baseline}, delta: ${summary.tsErrors.delta >= 0 ? "+" : ""}${summary.tsErrors.delta})`,
  `- Backend ESLint warnings: ${summary.lintWarnings.current ?? "unavailable"} (baseline: ${summary.lintWarnings.baseline ?? "unavailable"}, delta: ${
    summary.lintWarnings.delta == null ? "unavailable" : `${summary.lintWarnings.delta >= 0 ? "+" : ""}${summary.lintWarnings.delta}`
  })`,
  `- ESLint errors during summary run: ${summary.lintWarnings.errors ?? "unavailable"}`,
  "",
  "## Notes",
  "",
  `- TypeScript command completed successfully: ${summary.tsErrors.commandSucceeded}`,
  `- ESLint command completed successfully: ${summary.lintWarnings.commandSucceeded}`,
].join("\n");

fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(path.join(artifactsDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(artifactsDir, "summary.md"), `${markdown}\n`);

console.log(markdown);
