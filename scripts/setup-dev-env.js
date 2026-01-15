#!/usr/bin/env node

/**
 * Development Environment Setup Script
 *
 * DEPRECATED: This script delegates to the canonical env-compiler.
 * Use `npm run dx:env` directly for environment configuration.
 *
 * Kept for backwards compatibility.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function main() {
  console.log("🔧 Setting up development environment...\n");
  console.log("Note: Delegating to canonical env-compiler (scripts/dx/env-compiler.js)\n");

  try {
    // Delegate to the single source of truth
    execSync("node scripts/dx/env-compiler.js --mode local --force", {
      cwd: projectRoot,
      stdio: "inherit",
    });

    console.log("\n🎉 Development environment setup complete!");
    console.log("\nNext steps:");
    console.log("  npm run dx        # Start development stack");
    console.log("  npm run db:verify # Verify database schema");
    console.log("  npm run seed:demo # Create demo user");
    console.log("\nThen open http://localhost:5173");
  } catch (error) {
    console.error("\n❌ Setup failed. Check errors above.");
    process.exit(1);
  }
}

main();
