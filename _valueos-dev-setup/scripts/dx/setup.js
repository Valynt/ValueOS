#!/usr/bin/env node

/**
 * ValueOS Developer Experience Setup
 * Automated setup script for local development environment
 */

import { displayPlatformInfo } from "../lib/platform.js";
import { checkPrerequisites } from "../lib/prerequisites.js";
import { setupEnvironment } from "../lib/environment.js";
import { progressTracker, spinner } from "../lib/progress.js";
import { retryWithRecovery } from "../lib/recovery.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writePortsEnvFile } from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const shouldStart =
  args.has("--start") || /^(1|true|yes)$/i.test(process.env.START_DEV_SERVER || "");
const shouldSeed = args.has("--seed") || /^(1|true|yes)$/i.test(process.env.SEED_DB || "");

if (args.has("--help") || args.has("-h")) {
  console.log("Usage: node scripts/dx/setup.js [--start] [--seed]");
  console.log("");
  console.log("Options:");
  console.log("  --start   Start the dev environment via pnpm run dx after setup");
  console.log("  --seed    Seed the database after setup (requires a running database)");
  process.exit(0);
}

// Track setup metrics
const metrics = {
  startTime: Date.now(),
  platform: null,
  steps: [],
  success: false,
};

/**
 * Execute command with progress tracking
 */
function exec(command, description) {
  const stepStart = Date.now();
  console.log(`\n⏳ ${description}...`);

  try {
    execSync(command, {
      stdio: "inherit",
      cwd: path.resolve(__dirname, "../.."),
    });
    const duration = Date.now() - stepStart;
    metrics.steps.push({ name: description, success: true, duration });
    console.log(`✅ ${description} (${(duration / 1000).toFixed(1)}s)`);
    return true;
  } catch (error) {
    const duration = Date.now() - stepStart;
    metrics.steps.push({ name: description, success: false, duration });
    console.error(`❌ ${description} failed`);
    return false;
  }
}

/**
 * Check if .env file exists
 */
function envFileExists() {
  const projectRoot = path.resolve(__dirname, "../..");
  return (
    fs.existsSync(path.join(projectRoot, "ops", "env", ".env.local")) ||
    fs.existsSync(path.join(projectRoot, ".env.local"))
  );
}

/**
 * Check for an existing DX session
 */
function getExistingDxSession() {
  const projectRoot = path.resolve(__dirname, "../..");
  const dxStatePath = path.join(projectRoot, ".dx-state.json");

  if (!fs.existsSync(dxStatePath)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(dxStatePath, "utf8"));
    try {
      process.kill(state.pid, 0);
      return state;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Ensure .env exists for tooling that expects it
 */
function ensureDotEnvFromLocal() {
  const projectRoot = path.resolve(__dirname, "../..");
  const envLocalPath = fs.existsSync(path.join(projectRoot, "ops", "env", ".env.local"))
    ? path.join(projectRoot, "ops", "env", ".env.local")
    : path.join(projectRoot, ".env.local");
  const envPath = path.join(projectRoot, ".env");

  if (!fs.existsSync(envPath) && fs.existsSync(envLocalPath)) {
    fs.copyFileSync(envLocalPath, envPath);
    console.log("✅ Created .env from ops/env/.env.local");
  }
}

function ensurePortsEnv() {
  // Delegate to canonical env-compiler for .env.ports
  const projectRoot = path.resolve(__dirname, "../..");
  const portsPath = path.join(projectRoot, "ops", "env", ".env.ports");

  // Use writePortsEnvFile for backwards compatibility, but env-compiler is authoritative
  writePortsEnvFile(portsPath);
}

/**
 * Generate environment files using the canonical env-compiler
 */
function generateEnvFiles(mode = "local") {
  console.log("\n📝 Generating environment files...");
  try {
    execSync(`node scripts/dx/env-compiler.js --mode ${mode} --force`, {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to generate environment files");
    return false;
  }
}

/**
 * Load ops/env/.env.local into process.env
 */
async function loadEnvLocal() {
  const projectRoot = path.resolve(__dirname, "../..");
  const envLocalPath = fs.existsSync(path.join(projectRoot, "ops", "env", ".env.local"))
    ? path.join(projectRoot, "ops", "env", ".env.local")
    : path.join(projectRoot, ".env.local");

  if (fs.existsSync(envLocalPath)) {
    try {
      const dotenv = await import("dotenv");
      dotenv.config({ path: envLocalPath });
    } catch (err) {
      // If dotenv is not yet installed, skip loading here; it will be available after deps install.
    }
  }
}

/**
 * Install dependencies
 */
async function installDependencies() {
  console.log("\n📦 Installing dependencies...");
  console.log("   This may take a few minutes...\n");

  // Use pnpm install --frozen-lockfile for faster, more reliable installs
  const command = fs.existsSync(path.resolve(__dirname, "../../package-lock.json"))
    ? "pnpm install --frozen-lockfile"
    : "pnpm install";

  return exec(command, "Install dependencies");
}

/**
 * Ensure Supabase CLI is available on PATH. If missing, attempt to install it globally via pnpm.
 */
async function ensureSupabaseCli() {
  try {
    execSync("supabase --version", { stdio: "ignore" });
    return true;
  } catch (err) {
    console.log("\n⚠️  Supabase CLI not found. Attempting to install via pnpm add -g supabase...");
    try {
      execSync("pnpm add -g supabase", { stdio: "inherit", cwd: path.resolve(__dirname, "../..") });
      // verify
      execSync("supabase --version", { stdio: "ignore" });
      console.log("✅ Supabase CLI installed and available on PATH");
      return true;
    } catch (installErr) {
      console.error("\n❌ Automatic Supabase CLI install failed.");
      console.error(
        "   Please install it manually: npm install -g supabase OR pnpm add -g supabase"
      );
      return false;
    }
  }
}

/**
 * Seed the database
 */
async function seedDatabase() {
  await loadEnvLocal();
  return exec("bash scripts/db-seed.sh", "Seed database");
}

/**
 * Display success message
 */
function displaySuccess() {
  const duration = Date.now() - metrics.startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Setup complete! 🎉");
  console.log("=".repeat(60));
  console.log(`\n⏱️  Time: ${minutes}m ${seconds}s`);
  console.log("\n📋 Next steps:");
  console.log("   1. Start development: pnpm run dx");
  console.log("   2. Open frontend: http://localhost:5173");
  console.log("   3. Read docs: docs/GETTING_STARTED.md");
  console.log("\n💡 Useful commands:");
  console.log("   pnpm run health     - Check system health");
  console.log("   pnpm run dx         - Start all services");
  console.log("   ./scripts/dc ps  - Check Docker services");
  console.log("\n🚀 Happy coding!\n");
}

/**
 * Display failure message
 */
function displayFailure(error) {
  console.log("\n" + "=".repeat(60));
  console.log("❌ Setup failed");
  console.log("=".repeat(60));
  console.log(`\n${error.message}\n`);
  console.log("💡 Troubleshooting:");
  console.log("   1. Check error messages above");
  console.log("   2. Ensure Docker is running");
  console.log("   3. Check docs/TROUBLESHOOTING.md");
  console.log("   4. Ask for help in #engineering\n");
}

/**
 * Save metrics
 */
function saveMetrics() {
  const projectRoot = path.resolve(__dirname, "../..");
  const metricsPath = path.join(projectRoot, ".dx-metrics.json");

  try {
    const existingMetrics = fs.existsSync(metricsPath)
      ? JSON.parse(fs.readFileSync(metricsPath, "utf8"))
      : [];

    existingMetrics.push({
      ...metrics,
      timestamp: new Date().toISOString(),
      duration: Date.now() - metrics.startTime,
    });

    fs.writeFileSync(metricsPath, JSON.stringify(existingMetrics, null, 2));
  } catch (error) {
    // Silently fail - metrics are nice to have but not critical
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 ValueOS Developer Experience Setup");
  console.log("=".repeat(60));

  try {
    // Step 1: Detect platform
    const { platform, config } = displayPlatformInfo();
    metrics.platform = platform;

    // Step 2: Check prerequisites
    const prereqsPassed = await checkPrerequisites();
    if (!prereqsPassed) {
      throw new Error("Prerequisites check failed");
    }

    // Step 3: Setup environment
    if (!envFileExists()) {
      console.log("\n🔧 Setting up environment configuration...");
      await setupEnvironment({
        projectName: "valueos-dev",
        environment: "development",
        enableDebug: true,
        envFile: "ops/env/.env.local",
      });
    } else {
      console.log("\n✅ ops/env/.env.local already exists, skipping environment setup");
      console.log("   To regenerate: rm ops/env/.env.local && pnpm run setup\n");
    }

    ensureDotEnvFromLocal();
    ensurePortsEnv();
    // Load ops/env/.env.local into process.env so child processes (like db setup)
    // receive necessary variables such as SUPABASE_PROJECT_ID.
    await loadEnvLocal();

    // Step 4: Install dependencies
    const depsSuccess = await installDependencies();
    if (!depsSuccess) {
      throw new Error("Dependency installation failed");
    }

    // Step 5: Ensure Supabase and DB migrations are applied
    console.log("\n🗄️  Setting up Supabase and applying database migrations...");

    // Ensure Supabase CLI is available (attempt auto-install if missing)
    await ensureSupabaseCli();

    // If essential Supabase environment variables are not set, skip DB setup
    // to avoid failing the overall setup flow for users who prefer to
    // manage Supabase manually (e.g., using local containers or remote projects).
    if (!process.env.SUPABASE_PROJECT_ID || !process.env.SUPABASE_DB_PASSWORD) {
      console.log(
        "\n⚠️  SUPABASE_PROJECT_ID or SUPABASE_DB_PASSWORD not set — skipping Supabase DB setup and migrations."
      );
      console.log(
        "   To run DB setup later: set SUPABASE_PROJECT_ID and SUPABASE_DB_PASSWORD, then run `pnpm run setup`."
      );
    } else {
      // First, link to Supabase Cloud project
      const cloudLinkSuccess = exec("scripts/supabase/cloud.sh", "Link Supabase Cloud project");
      if (!cloudLinkSuccess) {
        throw new Error("Supabase Cloud project linking failed");
      }

      // Then apply migrations
      const dbSetupSuccess = exec("pnpm run db:setup", "Supabase DB setup & migrations");
      if (!dbSetupSuccess) {
        throw new Error("Supabase DB setup or migrations failed");
      }

      // Step 6: Seed demo user/data so `pnpm run dx` has an account to login with
      console.log("\n🌱 Seeding demo user and sample data...");
      const demoSeedSuccess = exec("pnpm run seed:demo", "Seed demo user");
      if (!demoSeedSuccess) {
        throw new Error("Demo data seeding failed");
      }
    }

    // Step 5: Optional database seed
    if (shouldSeed) {
      const seedSuccess = await seedDatabase();
      if (!seedSuccess) {
        throw new Error("Database seed failed");
      }
    }

    // Step 6: Optional start
    if (shouldStart) {
      const existingSession = getExistingDxSession();
      if (existingSession) {
        console.log(
          `\n⚠️  Development environment already running (pid ${existingSession.pid}, mode ${existingSession.mode}).`
        );
        console.log("   Skipping automatic start to avoid duplicate processes.\n");
      } else {
        const startSuccess = exec("pnpm run dx", "Start development environment");
        if (!startSuccess) {
          throw new Error("Development start failed");
        }
      }
    }

    // Success!
    metrics.success = true;
    displaySuccess();
  } catch (error) {
    metrics.success = false;
    displayFailure(error);
    process.exit(1);
  } finally {
    saveMetrics();
  }
}

// Run setup
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
