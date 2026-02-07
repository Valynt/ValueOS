#!/usr/bin/env tsx

/**
 * Pre-Add Type Check Script
 *
 * Runs TypeScript compiler on staged files only to catch errors before staging.
 * Use this before `git add` to prevent ratchet violations.
 *
 * Usage: tsx scripts/pre-add-check.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const projectRoot = process.cwd();

function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf-8",
    });
    return output.split("\n").filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  } catch (e) {
    console.error("Failed to get staged files:", e);
    return [];
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log("✅ No staged TypeScript files to check.");
    return;
  }

  console.log(`🔍 Checking ${stagedFiles.length} staged TypeScript files...`);

  try {
    // Run tsc on the specific files
    const tscCommand = `pnpm exec tsc --noEmit ${stagedFiles.join(" ")}`;
    execSync(tscCommand, { stdio: "inherit", cwd: projectRoot });
    console.log("✅ All staged TypeScript files pass type check.");
  } catch (e) {
    console.error("❌ TypeScript errors found in staged files. Please fix before staging.");
    process.exit(1);
  }
}

main();
