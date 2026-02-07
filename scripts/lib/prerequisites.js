#!/usr/bin/env node

/**
 * Prerequisites Checker
 * Validates system requirements before setup
 */

import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { detectPlatform, getPlatformConfig } from "./platform.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function findExecutable(cmd) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, cmd);
    if (fs.existsSync(candidate) && fs.statSync(candidate).mode & 0o111) {
      return candidate;
    }
  }
  return null;
}

/**
 * Execute command and return output
 */
function exec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  } catch (error) {
    // Some sandboxes throw with EPERM even when the command succeeds (status 0).
    // Treat "error with output + status 0" as success to avoid false negatives.
    if (error?.status === 0) {
      const out = (error.stdout || "").toString().trim();
      if (out) return out;
    }
    return null;
  }
}

function getRequiredNodeVersion() {
  const nvmrcPath = path.join(projectRoot, ".nvmrc");
  if (fs.existsSync(nvmrcPath)) {
    const raw = fs.readFileSync(nvmrcPath, "utf8").trim().replace(/^v/, "");
    if (raw) {
      const major = parseInt(raw.split(".")[0], 10);
      if (!Number.isNaN(major)) {
        return { major, raw };
      }
    }
  }
  return { major: 20, raw: "20" };
}

/**
 * Check Node.js version
 */
export async function checkNode() {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0]);
  const required = getRequiredNodeVersion();
  const requiredMajor = required.major;
  const requiredRaw = required.raw;

  const passed = major >= requiredMajor;

  return {
    name: "Node.js",
    passed,
    version: nodeVersion,
    required: `>= ${requiredRaw}`,
    message: passed ? `✅ Node.js ${nodeVersion}` : `❌ Node.js ${nodeVersion} is too old`,
    fix: passed
      ? null
      : `
   Required: >= ${requiredRaw}

   Fix:
   $ nvm install ${requiredRaw}
   $ nvm use ${requiredRaw}

   Or download from: https://nodejs.org/`,
  };
}

/**
 * Check Docker installation and status
 */
export async function checkDocker() {
  const dockerVersion = exec("docker --version");

  if (!dockerVersion) {
    return {
      name: "Docker",
      passed: false,
      version: null,
      required: "Docker Engine or Docker Desktop",
      message: "❌ Docker not installed",
      fix: `
   Install Docker:

   macOS: https://docs.docker.com/desktop/install/mac-install/
   Windows: https://docs.docker.com/desktop/install/windows-install/
   Linux: https://docs.docker.com/engine/install/`,
    };
  }

  const isDevContainer =
    process.env.REMOTE_CONTAINERS === "true" ||
    process.env.CODESPACES === "true" ||
    fs.existsSync("/.dockerenv");

  // Check if Docker daemon is running
  let daemonError = null;
  try {
    execSync("docker info", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) {
    daemonError = error;
  }

  if (daemonError) {
    const stderr = daemonError?.stderr ? daemonError.stderr.toString() : "";
    const message = `${daemonError.message || ""}\n${stderr}`.trim().toLowerCase();
    const platform = detectPlatform();
    const config = getPlatformConfig(platform);
    let fix = `
   Start Docker:

   ${config.dockerCommand}

   Then run setup again.`;

    if (message.includes("permission denied")) {
      fix = isDevContainer
        ? `
   Docker socket permission denied inside DevContainer.
   Fix:
     - Ensure /var/run/docker.sock is mounted
     - Rebuild the DevContainer with docker-outside-of-docker enabled
     - Avoid no-new-privileges if sudo is required`
        : `
   Add your user to the docker group:
   $ sudo usermod -aG docker $USER
   $ newgrp docker`;
    }

    return {
      name: "Docker",
      passed: false,
      version: dockerVersion,
      required: "Docker daemon running",
      message: message.includes("permission denied")
        ? "❌ Docker permission denied"
        : "❌ Docker is not running",
      fix,
    };
  }

  return {
    name: "Docker",
    passed: true,
    version: dockerVersion,
    required: "Docker Engine or Docker Desktop",
    message: `✅ Docker ${dockerVersion}`,
    fix: null,
  };
}

/**
 * Check package manager availability
 */
export async function checkPnpm() {
  let pnpmVersion = exec("pnpm --version");

  if (!pnpmVersion) {
    const pnpmPath = findExecutable("pnpm");
    if (pnpmPath) {
      pnpmVersion = "unknown";
    }
  }

  if (!pnpmVersion) {
    return {
      name: "pnpm",
      passed: false,
      version: null,
      required: "pnpm (via Corepack)",
      message: "❌ pnpm not found",
      fix: `
   Enable Corepack and install pnpm:

   $ corepack enable
   $ corepack prepare pnpm@9.15.0 --activate`,
    };
  }

  return {
    name: "pnpm",
    passed: true,
    version: pnpmVersion,
    required: "pnpm (via Corepack)",
    message: `✅ pnpm ${pnpmVersion}`,
    fix: null,
  };
}

/**
 * Check if local Supabase is expected based on env vars
 */
function isLocalSupabaseExpected() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const localFlag = process.env.DX_SUPABASE_LOCAL;
  const skipFlag = process.env.DX_SKIP_SUPABASE;
  const forceFlag = process.env.DX_FORCE_SUPABASE;

  if (skipFlag === "1" || skipFlag === "true") {
    return false;
  }

  if (forceFlag === "1" || forceFlag === "true") {
    return true;
  }

  if (localFlag === "0" || localFlag === "false") {
    return false;
  }

  if (localFlag === "1" || localFlag === "true") {
    return true;
  }

  return supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1");
}

/**
 * Check Supabase CLI availability
 * Only required if local Supabase is expected
 */
export async function checkSupabaseCli() {
  const localExpected = isLocalSupabaseExpected();
  const supabaseVersion = exec("supabase --version");

  if (!supabaseVersion) {
    if (!localExpected) {
      return {
        name: "Supabase CLI",
        passed: true,
        version: null,
        required: "Optional (not using local Supabase)",
        optional: true,
        message: "⚠️  Supabase CLI not installed (optional - using remote Supabase)",
        fix: null,
      };
    }

    return {
      name: "Supabase CLI",
      passed: false,
      version: null,
      required: "Supabase CLI (local Supabase detected)",
      optional: false,
      message: "❌ Supabase CLI not installed",
      fix: `
   Install Supabase CLI:

   $ pnpm install -g supabase

   Or disable local Supabase check:
   $ export DX_SUPABASE_LOCAL=0`,
    };
  }

  return {
    name: "Supabase CLI",
    passed: true,
    version: supabaseVersion,
    required: localExpected ? "Supabase CLI (local Supabase)" : "Supabase CLI",
    optional: !localExpected,
    message: `✅ Supabase CLI ${supabaseVersion}`,
    fix: null,
  };
}

/**
 * Check available disk space
 */
export async function checkDiskSpace() {
  const requiredGB = 10;

  try {
    const platform = os.platform();
    let availableGB;

    if (platform === "win32") {
      // Windows
      const output = exec("wmic logicaldisk get size,freespace,caption");
      if (output) {
        const lines = output.split("\n").filter((l) => l.trim());
        const diskLine = lines[1]; // First disk
        const parts = diskLine.trim().split(/\s+/);
        const freeBytes = parseInt(parts[1]);
        availableGB = freeBytes / 1024 ** 3;
      }
    } else {
      // Unix-like systems
      const output = exec("df -k .");
      if (output) {
        const lines = output.split("\n");
        const diskLine = lines[1];
        const parts = diskLine.trim().split(/\s+/);
        const availableKB = parseInt(parts[3]);
        availableGB = availableKB / 1024 ** 2;
      }
    }

    if (!availableGB) {
      return {
        name: "Disk Space",
        passed: true,
        version: "Unknown",
        required: `>= ${requiredGB} GB`,
        optional: true,
        message: "⚠️  Could not check disk space",
        fix: null,
      };
    }

    const passed = availableGB >= requiredGB;

    return {
      name: "Disk Space",
      passed,
      version: `${availableGB.toFixed(1)} GB available`,
      required: `>= ${requiredGB} GB`,
      optional: true,
      message: passed
        ? `✅ ${availableGB.toFixed(1)} GB available`
        : `❌ Only ${availableGB.toFixed(1)} GB available`,
      fix: passed
        ? null
        : `
   Required: >= ${requiredGB} GB free space
   Available: ${availableGB.toFixed(1)} GB

   Free up disk space and try again.`,
    };
  } catch (error) {
    return {
      name: "Disk Space",
      passed: true,
      version: "Unknown",
      required: `>= ${requiredGB} GB`,
      optional: true,
      message: "⚠️  Could not check disk space",
      fix: null,
    };
  }
}

/**
 * Check Git installation
 */
export async function checkGit() {
  const gitVersion = exec("git --version");

  if (!gitVersion) {
    return {
      name: "Git",
      passed: false,
      version: null,
      required: "Git",
      optional: true,
      message: "❌ Git not installed",
      fix: `
   Install Git:

   macOS: brew install git
   Windows: https://git-scm.com/download/win
   Linux: sudo apt-get install git (or equivalent)`,
    };
  }

  return {
    name: "Git",
    passed: true,
    version: gitVersion,
    required: "Git",
    optional: true,
    message: `✅ ${gitVersion}`,
    fix: null,
  };
}

/**
 * Run all prerequisite checks
 */
export async function checkPrerequisites() {
  console.log("\n🔍 Checking prerequisites...\n");

  const checks = await Promise.all([
    checkNode(),
    checkDocker(),
    checkPnpm(),
    checkSupabaseCli(),
    checkDiskSpace(),
    checkGit(),
  ]);

  // Display results
  checks.forEach((check) => {
    console.log(check.message);
  });

  const requiredFailures = checks.filter((c) => !c.passed && !c.optional);
  const optionalFailures = checks.filter((c) => !c.passed && c.optional);

  if (requiredFailures.length > 0) {
    console.log("\n❌ Prerequisites check failed\n");
    requiredFailures.forEach((check) => {
      if (check.fix) {
        console.log(`${check.name}:`);
        console.log(check.fix);
        console.log("");
      }
    });
    return false;
  }

  if (optionalFailures.length > 0) {
    console.log("\n⚠️  Optional checks failed (continuing):\n");
    optionalFailures.forEach((check) => {
      if (check.fix) {
        console.log(`${check.name}:`);
        console.log(check.fix);
        console.log("");
      }
    });
  }

  console.log("\n✅ All required prerequisites met!\n");
  return true;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  checkPrerequisites().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
