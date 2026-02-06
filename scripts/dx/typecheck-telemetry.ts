#!/usr/bin/env tsx
/**
 * TypeScript Debt Telemetry
 *
 * Generates a comprehensive report of TypeScript errors for tracking debt reduction.
 * Can be run locally or in CI to track trends over time.
 *
 * Usage:
 *   pnpm run typecheck:signal           # Full report
 *   pnpm run typecheck:signal --json    # JSON output for CI
 *   pnpm run typecheck:signal --summary # Brief summary only
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";
import { listWorkspacePackageDirsForUpdate, loadRatchetBaselines } from "./ts-ratchet-baseline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

interface ErrorInfo {
  file: string;
  line: number;
  code: string;
  message: string;
}

interface TelemetryReport {
  timestamp: string;
  totalErrors: number;
  filesWithErrors: number;
  errorsByCode: Record<string, number>;
  errorsByPackage: Record<string, number>;
  topFiles: Array<{ file: string; count: number }>;
  topMissingModules: Array<{ module: string; count: number }>;
  cascadeIndicators: {
    likelyGeneratedTypeIssues: number;
    pathAliasIssues: number;
    strictModeIssues: number;
  };
}

const ERROR_CODE_DESCRIPTIONS: Record<string, string> = {
  TS6133: "Unused variable/parameter",
  TS2307: "Cannot find module",
  TS2339: "Property does not exist on type",
  TS7006: "Parameter implicitly has 'any' type",
  TS2322: "Type is not assignable",
  TS2345: "Argument type not assignable",
  TS18048: "Value is possibly undefined",
  TS2554: "Wrong number of arguments",
  TS2375: "exactOptionalPropertyTypes issue",
  TS2532: "Object is possibly undefined",
  TS2353: "Unknown property in object literal",
  TS18047: "Value is possibly null",
  TS2379: "Argument not assignable with exactOptionalPropertyTypes",
  TS2305: "Module has no exported member",
  TS2551: "Property does not exist (did you mean?)",
  TS7030: "Not all code paths return a value",
  TS2304: "Cannot find name",
  TS18046: "Value is of type unknown",
  TS4114: "Override modifier missing",
  TS2412: "Index signature parameter not compatible",
};

function runTypecheck(): ErrorInfo[] {
  console.log("🔍 Discovering tsconfig.json files in apps/ and packages/...");
  // Find all tsconfig.json files to treat as separate projects
  const configFiles = execSync(
    "find apps packages -name tsconfig.json -not -path '*/node_modules/*'",
    { encoding: "utf8" }
  )
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((p) => path.resolve(projectRoot, p.trim()));

  const errors: ErrorInfo[] = [];

  for (const configPath of configFiles) {
    const relativeConfigPath = path.relative(projectRoot, configPath);

    // Skip if it's strictly a solution-style tsconfig with references but no files (optional optim)
    // But for now, we process all to be safe.

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      console.error(
        `   ⚠️ Error reading ${relativeConfigPath}:`,
        ts.formatDiagnostics([configFile.error], {
          getCanonicalFileName: (f) => f,
          getCurrentDirectory: () => path.dirname(configPath),
          getNewLine: () => "\n",
        })
      );
      continue;
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );

    // Create program for this specific project
    // This respects the specific 'lib', 'types', and 'strict' settings of that project!
    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
      projectReferences: parsedConfig.projectReferences,
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);

    for (const d of diagnostics) {
      let line = 0;
      let file = "";

      if (d.file) {
        file = path.relative(projectRoot, d.file.fileName).replace(/\\/g, "/");
        if (d.start !== undefined) {
          const pos = d.file.getLineAndCharacterOfPosition(d.start);
          line = pos.line + 1;
        }
      } else {
        file = `config:${relativeConfigPath.replace(/\\/g, "/")}`;
      }

      // De-duplicate errors (since files might be included in multiple tsconfigs)
      // We use a simple composite key
      const key = `${file}:${line}:${d.code}`;
      const existing = errors.find(
        (e) => `${e.file}:${e.line}:${e.code.replace("TS", "")}` === key
      );

      if (!existing) {
        errors.push({
          file,
          line,
          code: `TS${d.code}`,
          message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        });
      }
    }
  }

  return errors;
}

// Previously used regex parsing - now we get structured objects directly
// Keeping for reference if we need to revert to shell execution
/*
function parseErrors(output: string): ErrorInfo[] {
  const errors: ErrorInfo[] = [];
  const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    errors.push({
      file: match[1] ?? "",
      line: parseInt(match[2] ?? "0", 10),
      // column: parseInt(match[3] ?? "0", 10),
      code: match[4] ?? "",
      message: match[5] ?? "",
    });
  }

  return errors;
}
*/

function extractPackage(filePath: string): string {
  const packageMatch = filePath.match(/^(packages\/[^/]+|apps\/[^/]+)/);
  return packageMatch?.[1] ?? "root";
}

async function loadStrictZones(): Promise<string[]> {
  try {
    const configPath = path.join(projectRoot, "packages/config-v2/strict-zones.config.js");
    if (!fs.existsSync(configPath)) return [];

    // Dynamic import for ESM config
    const config = await import(configPath);
    return config.default?.zones || [];
  } catch (e) {
    console.warn("⚠️ Failed to load strict zones config:", e);
    return [];
  }
}

async function updatePackageBaselines(report: TelemetryReport): Promise<void> {
  loadRatchetBaselines(projectRoot);

  console.log("💾 Updating local sidecar baselines (.ts-debt.json)...");
  const packageDirs = listWorkspacePackageDirsForUpdate(projectRoot);

  for (const pkgName of packageDirs) {
    const sidecarPath = path.join(projectRoot, pkgName, ".ts-debt.json");
    const count = report.errorsByPackage[pkgName] ?? 0;
    fs.writeFileSync(sidecarPath, JSON.stringify({ baseline: count }, null, 2));
  }

  console.log(`✅ Updated baselines for ${packageDirs.length} workspaces.`);
}

async function enforceRatchet(report: TelemetryReport): Promise<boolean> {
  const baselines = loadRatchetBaselines(projectRoot);

  let failed = false;
  let regressionCount = 0;
  let winCount = 0;

  for (const [pkgName, baseline] of Object.entries(baselines.packageBaselines)) {
    const count = report.errorsByPackage[pkgName] ?? 0;
    if (count > baseline) {
      console.error(`   ❌ Regression in ${pkgName}: ${count} errors (baseline: ${baseline})`);
      regressionCount++;
      failed = true;
    } else if (count < baseline) {
      console.log(`   🎉 Debt reduced in ${pkgName}: ${count} errors (was ${baseline})`);
      console.log(`      → Run pnpm run typecheck:signal --update-baseline to lock in this win!`);
      winCount++;
    }
  }

  if (regressionCount > 0) {
    console.error(`\n   FAILED: ${regressionCount} packages have increased error counts.`);
  } else {
    console.log("   ✅ No regressions detected.");
  }

  if (winCount > 0) {
    console.log(`\n   ✨ ${winCount} packages have improved quality! Great job.`);
  }

  return failed;
}

// Helpers...

function extractMissingModule(message: string): string | null {
  const match = message.match(/Cannot find module '([^']+)'/);
  return match ? (match[1] ?? null) : null;
}

function generateReport(errors: ErrorInfo[]): TelemetryReport {
  const errorsByCode: Record<string, number> = {};
  const errorsByPackage: Record<string, number> = {};
  const errorsByFile: Record<string, number> = {};
  const missingModules: Record<string, number> = {};

  let pathAliasIssues = 0;
  let strictModeIssues = 0;
  let generatedTypeIssues = 0;

  for (const error of errors) {
    // Count by code
    errorsByCode[error.code] = (errorsByCode[error.code] ?? 0) + 1;

    // Count by package
    const pkg = extractPackage(error.file);
    errorsByPackage[pkg] = (errorsByPackage[pkg] ?? 0) + 1;

    // Count by file
    errorsByFile[error.file] = (errorsByFile[error.file] ?? 0) + 1;

    // Extract missing modules
    if (error.code === "TS2307") {
      const module = extractMissingModule(error.message);
      if (module) {
        missingModules[module] = (missingModules[module] ?? 0) + 1;

        // Check for path alias issues
        if (module.startsWith("@/") || module.startsWith("@lib/")) {
          pathAliasIssues++;
        }
      }
    }

    // Detect strict mode cascade errors
    if (["TS2375", "TS2379", "TS18048", "TS18047"].includes(error.code)) {
      strictModeIssues++;
    }

    // Detect likely generated type issues (types/index.ts)
    if (error.file.includes("types/index")) {
      generatedTypeIssues++;
    }
  }

  const uniqueFiles = new Set(errors.map((e) => e.file));

  const topFiles = Object.entries(errorsByFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file, count]) => ({ file, count }));

  const topMissingModules = Object.entries(missingModules)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([module, count]) => ({ module, count }));

  return {
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    filesWithErrors: uniqueFiles.size,
    errorsByCode,
    errorsByPackage,
    topFiles,
    topMissingModules,
    cascadeIndicators: {
      likelyGeneratedTypeIssues: generatedTypeIssues,
      pathAliasIssues,
      strictModeIssues,
    },
  };
}

function printReport(report: TelemetryReport, summary = false): void {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           TypeScript Debt Telemetry Report                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`📅 Timestamp: ${report.timestamp}`);
  console.log(`❌ Total Errors: ${report.totalErrors.toLocaleString()}`);
  console.log(`📁 Files with Errors: ${report.filesWithErrors.toLocaleString()}`);
  console.log("");

  // Cascade indicators
  console.log("🔍 Cascade Indicators (systemic root causes):");
  console.log(`   Path alias issues (@/...): ${report.cascadeIndicators.pathAliasIssues}`);
  console.log(`   Strict mode cascade: ${report.cascadeIndicators.strictModeIssues}`);
  console.log(`   Generated types issues: ${report.cascadeIndicators.likelyGeneratedTypeIssues}`);
  console.log("");

  if (summary) return;

  // Error codes
  console.log("📊 Top Error Codes:");
  const sortedCodes = Object.entries(report.errorsByCode)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const [code, count] of sortedCodes) {
    const desc = ERROR_CODE_DESCRIPTIONS[code] || "Unknown";
    const pct = ((count / report.totalErrors) * 100).toFixed(1);
    console.log(`   ${code}: ${count.toString().padStart(5)} (${pct}%) - ${desc}`);
  }
  console.log("");

  // Packages
  console.log("📦 Errors by Package:");
  const sortedPackages = Object.entries(report.errorsByPackage).sort((a, b) => b[1] - a[1]);

  for (const [pkg, count] of sortedPackages) {
    const pct = ((count / report.totalErrors) * 100).toFixed(1);
    const bar = "█".repeat(Math.ceil((count / report.totalErrors) * 30));
    console.log(`   ${pkg.padEnd(25)} ${count.toString().padStart(5)} (${pct}%) ${bar}`);
  }
  console.log("");

  // Top files
  console.log("🔥 Top 15 Files by Error Count:");
  for (const { file, count } of report.topFiles.slice(0, 15)) {
    console.log(`   ${count.toString().padStart(4)} errors: ${file}`);
  }
  console.log("");

  // Missing modules
  console.log("📭 Top Missing Modules (TS2307):");
  for (const { module, count } of report.topMissingModules) {
    console.log(`   ${count.toString().padStart(4)}x: ${module}`);
  }
  console.log("");

  // Actionable recommendations
  console.log("💡 Recommended Actions:");
  if (report.cascadeIndicators.pathAliasIssues > 50) {
    console.log("   ⚠️  HIGH: Fix path alias configuration in tsconfig.json");
    console.log("      Many @/ imports are failing - check baseUrl and paths");
  }
  if (report.cascadeIndicators.strictModeIssues > 200) {
    console.log("   ⚠️  Consider adding undefined to optional property types");
    console.log("      exactOptionalPropertyTypes causing cascade errors");
  }
  if (report.errorsByCode["TS6133"] && report.errorsByCode["TS6133"] > 500) {
    console.log("   ℹ️  Many unused variables - consider ESLint noUnusedVars instead");
    console.log("      Or add _ prefix to intentionally unused params");
  }
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const summaryOnly = args.includes("--summary");
  const verify = args.includes("--verify");
  const updateBaseline = args.includes("--update-baseline");

  console.log("🔍 Running TypeScript type check...");
  // Now returns ErrorInfo[]
  const errors = runTypecheck();
  const report = generateReport(errors);

  if (updateBaseline) {
    await updatePackageBaselines(report);
    process.exit(0);
  }

  if (jsonOutput) {
    // Write to file for CI artifact storage
    const artifactPath = path.join(projectRoot, ".typecheck-telemetry.json");
    fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${artifactPath}`);
  } else {
    printReport(report, summaryOnly);
  }

  if (verify) {
    const strictZones = await loadStrictZones();
    // Check strict zones using raw errors
    let strictFailed = false;
    for (const zone of strictZones) {
      const zoneErrors = errors.filter((e) => e.file.startsWith(zone));
      if (zoneErrors.length > 0) {
        console.error(`\n❌ STRICT ZONE VIOLATION: ${zone} has ${zoneErrors.length} errors.`);
        zoneErrors
          .slice(0, 5)
          .forEach((e) => console.error(`   ${e.file}(${e.line}): ${e.message}`));
        if (zoneErrors.length > 5) console.error(`   ...and ${zoneErrors.length - 5} more.`);
        strictFailed = true;
      }
    }

    const ratchetFailed = await enforceRatchet(report);
    if (strictFailed || ratchetFailed) {
      console.error("\n💥 Verification Failed. See above for details.");
      process.exit(1);
    }
  }

  // Exit with status based on error count trends (for CI)
  // This is informational - we don't fail the build on global typecheck
  process.exit(0);
}

main();
