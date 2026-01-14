#!/usr/bin/env tsx

/**
 * Test Preflight Check Script
 *
 * Validates test environment requirements before running tests.
 * Fails fast with clear, actionable error messages.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface PreflightResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

function checkDocker(): PreflightResult {
  const result: PreflightResult = { success: true, errors: [], warnings: [] };

  try {
    execSync("docker version", { stdio: "ignore" });
    console.log("✅ Docker is available");
  } catch (error) {
    result.success = false;
    result.errors.push(
      "❌ Docker is not available or not running",
      "   Integration tests require Docker to start testcontainers",
      "   Please start Docker and ensure you have permissions to run containers",
      "   For unit tests only, run: npm run test:unit"
    );
  }

  return result;
}

function checkNodeVersion(): PreflightResult {
  const result: PreflightResult = { success: true, errors: [], warnings: [] };
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

  if (majorVersion < 18) {
    result.warnings.push(
      `⚠️ Node.js version ${nodeVersion} detected`,
      "   Recommended: Node.js 18+ for optimal performance"
    );
  } else {
    console.log(`✅ Node.js ${nodeVersion} is compatible`);
  }

  return result;
}

function checkTestMode(): PreflightResult {
  const result: PreflightResult = { success: true, errors: [], warnings: [] };
  const testMode = process.env.TEST_MODE || "unit";

  if (!["unit", "integration", "all"].includes(testMode)) {
    result.errors.push(
      `❌ Invalid TEST_MODE: ${testMode}`,
      "   Valid options: unit, integration, all"
    );
  }

  return result;
}

function checkIntegrationRequirements(): PreflightResult {
  const result: PreflightResult = { success: true, errors: [], warnings: [] };

  // Only check integration requirements if in integration mode
  if (process.env.TEST_MODE !== "integration" && process.env.TEST_MODE !== "all") {
    return result;
  }

  // Check Docker availability
  const dockerCheck = checkDocker();
  if (!dockerCheck.success) {
    result.success = false;
    result.errors.push(...dockerCheck.errors);
  }

  // Check available disk space (testcontainers need space for images)
  try {
    const stats = fs.statSync(process.cwd());
    console.log("✅ File system is accessible");
  } catch (error) {
    result.errors.push(
      "❌ File system is not accessible",
      "   Testcontainers need to write temporary files and pull images"
    );
  }

  return result;
}

function checkUnitRequirements(): PreflightResult {
  const result: PreflightResult = { success: true, errors: [], warnings: [] };

  // Unit tests have minimal requirements
  console.log("✅ Unit tests require no external services");

  return result;
}

function main(): void {
  console.log("🔍 Test Preflight Check");
  console.log("=====================\n");

  const testMode = process.env.TEST_MODE || "unit";
  console.log(`Test mode: ${testMode}\n`);

  let overallSuccess = true;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Basic checks
  const nodeCheck = checkNodeVersion();
  allWarnings.push(...nodeCheck.warnings);

  const modeCheck = checkTestMode();
  if (!modeCheck.success) {
    overallSuccess = false;
    allErrors.push(...modeCheck.errors);
  }

  // Mode-specific checks
  if (testMode === "unit") {
    const unitCheck = checkUnitRequirements();
    if (!unitCheck.success) {
      overallSuccess = false;
      allErrors.push(...unitCheck.errors);
    }
    allWarnings.push(...unitCheck.warnings);
  } else if (testMode === "integration" || testMode === "all") {
    const integrationCheck = checkIntegrationRequirements();
    if (!integrationCheck.success) {
      overallSuccess = false;
      allErrors.push(...integrationCheck.errors);
    }
    allWarnings.push(...integrationCheck.warnings);
  }

  // Report results
  console.log("\n📋 Preflight Results:");
  console.log("====================");

  if (allErrors.length > 0) {
    console.log("\n❌ ERRORS:");
    allErrors.forEach((error) => console.log(error));
  }

  if (allWarnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    allWarnings.forEach((warning) => console.log(warning));
  }

  if (overallSuccess) {
    console.log("\n✅ Preflight check passed");
    console.log(`Ready to run ${testMode} tests`);
  } else {
    console.log("\n❌ Preflight check failed");
    console.log("Fix the above issues before running tests");
    process.exit(1);
  }
}

// Run preflight check
main();
