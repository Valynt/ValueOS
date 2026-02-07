#!/usr/bin/env node

/**
 * Security Pressure Test Runner
 *
 * Runs comprehensive security tests including:
 * - Cross-tenant attack simulation
 * - JWT tampering detection
 * - Injection probe testing
 *
 * Exits with code 1 if any security violations are detected
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);

console.log("🛡️  Starting Security Pressure Test Suite...\n");

// Test categories to run
const testSuites = [
  {
    name: "RLS Tenant Isolation Tests",
    command: "pnpm test --run tests/security/rls-tenant-isolation.test.ts",
    critical: true,
  },
  {
    name: "JWT Tampering Tests",
    command: 'pnpm test --run tests/integration/security-flows.test.ts -t "JWT Tampering"',
    critical: true,
  },
  {
    name: "Injection Probe Tests",
    command: 'pnpm test --run tests/integration/security-flows.test.ts -t "Injection Probe"',
    critical: true,
  },
];

let allPassed = true;
const results = [];

for (const suite of testSuites) {
  console.log(`🔍 Running ${suite.name}...`);

  try {
    const output = execSync(suite.command, {
      encoding: "utf8",
      cwd: path.resolve(SCRIPT_DIR, "../.."),
      stdio: "pipe",
    });

    console.log("✅ PASSED\n");
    results.push({ suite: suite.name, status: "PASSED", output: output.trim() });
  } catch (error) {
    console.log("❌ FAILED\n");
    console.log("Error output:", error.stdout || error.stderr);

    results.push({
      suite: suite.name,
      status: "FAILED",
      output: error.stdout || error.stderr,
      critical: suite.critical,
    });

    if (suite.critical) {
      allPassed = false;
    }
  }
}

// Summary
console.log("📊 Security Pressure Test Results:\n");

for (const result of results) {
  const status = result.status === "PASSED" ? "✅" : "❌";
  console.log(`${status} ${result.suite}: ${result.status}`);
  if (result.status === "FAILED" && result.critical) {
    console.log("   🚨 CRITICAL SECURITY VIOLATION DETECTED");
  }
}

console.log("\n" + "=".repeat(50));

if (allPassed) {
  console.log("🎉 All security tests PASSED. Pipeline can continue.");
  process.exit(0);
} else {
  console.log("🚨 SECURITY VIOLATIONS DETECTED. Pipeline HALTED.");
  console.log("Please review the failed tests and fix security issues before proceeding.");

  // Show detailed failure output
  const failures = results.filter((r) => r.status === "FAILED");
  for (const failure of failures) {
    console.log(`\n🔴 ${failure.suite} Failure Details:`);
    console.log(failure.output);
  }

  process.exit(1);
}
