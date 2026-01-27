#!/usr/bin/env node

/**
 * ValueOS CI Setup
 * Setup script for CI environments - installs dependencies and validates environment
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log("Usage: node scripts/dx/setup-ci.js");
  console.log("");
  console.log("CI setup script - installs dependencies and validates environment");
  process.exit(0);
}

/**
 * Execute command
 */
function exec(command, description) {
  console.log(`⏳ ${description}...`);

  try {
    execSync(command, {
      stdio: "inherit",
      cwd: projectRoot,
    });
    console.log(`✅ ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed`);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log("🚀 ValueOS CI Setup\n");

  // Ensure Node version
  const nvmrcPath = path.join(projectRoot, ".nvmrc");
  if (fs.existsSync(nvmrcPath)) {
    const expected = fs.readFileSync(nvmrcPath, "utf8").trim().replace(/^v/, "");
    const actual = process.versions.node;
    if (expected && expected !== actual) {
      console.error(`❌ Node ${expected} required but found ${actual}`);
      process.exit(1);
    }
  }

  // Ensure pnpm
  if (!exec("corepack enable", "Enable corepack")) process.exit(1);
  if (!exec("corepack prepare pnpm@9.15.0 --activate", "Prepare pnpm")) process.exit(1);

  // Install dependencies
  if (!exec("pnpm install --frozen-lockfile --prefer-offline", "Install dependencies"))
    process.exit(1);

  // Validate environment
  if (!exec("node scripts/dx/env-compiler.js --validate", "Validate environment")) process.exit(1);

  console.log("\n✅ CI setup complete");
}

main().catch((error) => {
  console.error("❌ CI setup failed:", error.message);
  process.exit(1);
});
