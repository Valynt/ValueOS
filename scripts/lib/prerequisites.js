#!/usr/bin/env node

/**
 * Prerequisites Checker
 * Validates system requirements before setup
 */

import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import { detectPlatform, getPlatformConfig } from "./platform.js";

/**
 * Execute command and return output
 */
function exec(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/**
 * Check Node.js version
 */
export async function checkNode() {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0]);
  const required = 18;

  const passed = major >= required;

  return {
    name: "Node.js",
    passed,
    version: nodeVersion,
    required: `>= ${required}.0.0`,
    message: passed ? `✅ Node.js ${nodeVersion}` : `❌ Node.js ${nodeVersion} is too old`,
    fix: passed
      ? null
      : `
   Required: >= ${required}.0.0
   
   Fix:
   $ nvm install ${required}
   $ nvm use ${required}
   
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

  // Check if Docker daemon is running
  const dockerRunning = exec("docker ps") !== null;

  if (!dockerRunning) {
    const platform = detectPlatform();
    const config = getPlatformConfig(platform);

    return {
      name: "Docker",
      passed: false,
      version: dockerVersion,
      required: "Docker daemon running",
      message: "❌ Docker is not running",
      fix: `
   Start Docker:
   
   ${config.dockerCommand}
   
   Then run setup again.`,
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
export async function checkPackageManager() {
  const npmVersion = exec("npm --version");

  if (!npmVersion) {
    return {
      name: "npm",
      passed: false,
      version: null,
      required: "npm (comes with Node.js)",
      message: "❌ npm not found",
      fix: `
   npm should be installed with Node.js.
   Reinstall Node.js from: https://nodejs.org/`,
    };
  }

  return {
    name: "npm",
    passed: true,
    version: npmVersion,
    required: "npm (comes with Node.js)",
    message: `✅ npm ${npmVersion}`,
    fix: null,
  };
}

/**
 * Check if local Supabase is expected based on env vars
 */
function isLocalSupabaseExpected() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const localFlag = process.env.DX_SUPABASE_LOCAL;

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
        message: "⚠️  Supabase CLI not installed (optional - using remote Supabase)",
        fix: null,
      };
    }

    return {
      name: "Supabase CLI",
      passed: false,
      version: null,
      required: "Supabase CLI (local Supabase detected)",
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
    checkPackageManager(),
    checkSupabaseCli(),
    checkDiskSpace(),
    checkGit(),
  ]);

  // Display results
  checks.forEach((check) => {
    console.log(check.message);
  });

  const allPassed = checks.every((c) => c.passed);
  const failures = checks.filter((c) => !c.passed);

  if (!allPassed) {
    console.log("\n❌ Prerequisites check failed\n");
    failures.forEach((check) => {
      if (check.fix) {
        console.log(`${check.name}:`);
        console.log(check.fix);
        console.log("");
      }
    });
    return false;
  }

  console.log("\n✅ All prerequisites met!\n");
  return true;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  checkPrerequisites().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
