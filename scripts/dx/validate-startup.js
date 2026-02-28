#!/usr/bin/env node

/**
 * DX Startup Validator
 *
 * Validates all prerequisites for a successful dev environment startup.
 * Run this before `pnpm run dx` to identify issues early.
 *
 * Usage:
 *   node scripts/dx/validate-startup.js
 *   pnpm run dx:validate
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const opsEnvDir = path.join(projectRoot, "ops", "env");

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  pass: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`),
};

const checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

function check(name, condition, fix = null) {
  if (condition) {
    log.pass(name);
    checks.passed++;
    return true;
  } else {
    log.fail(name);
    if (fix) {
      console.log(`   Fix: ${fix}`);
    }
    checks.failed++;
    return false;
  }
}

function warn(name, condition, message = null) {
  if (condition) {
    log.pass(name);
    checks.passed++;
  } else {
    log.warn(name);
    if (message) {
      console.log(`   ${message}`);
    }
    checks.warnings++;
  }
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd, args = "--version") {
  try {
    return execSync(`${cmd} ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function dockerAvailable() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

console.log(`
╔════════════════════════════════════════════════════════════════╗
║              ValueOS Startup Validator                         ║
╚════════════════════════════════════════════════════════════════╝
`);

// Section 1: Toolchain
log.section("Toolchain");

const nodeVersion = process.version.slice(1);
const [nodeMajor] = nodeVersion.split(".");
check(
  `Node.js ${nodeVersion} (major ${nodeMajor})`,
  nodeMajor === "20",
  "Use nvm install 20 && nvm use 20"
);

check(
  "pnpm available",
  commandExists("pnpm"),
  "corepack enable && corepack prepare pnpm@9.15.0 --activate"
);

const pnpmVersion = getVersion("pnpm", "-v");
warn(
  `pnpm version ${pnpmVersion}`,
  pnpmVersion === "9.15.0",
  `Expected 9.15.0, got ${pnpmVersion}`
);

check(
  "Supabase CLI available",
  commandExists("supabase") ||
    (commandExists("pnpm") && getVersion("pnpm", "dlx supabase --version")),
  "npm install -g supabase or use pnpm dlx supabase"
);

// Section 2: Docker
log.section("Docker");

check(
  "Docker available",
  dockerAvailable(),
  "Start Docker Desktop or rebuild devcontainer with docker-outside-of-docker feature"
);

if (dockerAvailable()) {
  try {
    const runningServices = execSync(
      "docker compose -f ops/compose/compose.yml ps --services --status running",
      { encoding: "utf8" }
    );
    const expected = ["postgres", "redis"];
    expected.forEach((service) => {
      warn(
        `Service ${service}`,
        runningServices.includes(service),
        "Run: pnpm run dx:up to start services"
      );
    });
  } catch {
    log.warn("Could not check Docker containers");
  }
}

// Section 3: Environment Files
log.section("Environment Files");

const envLocalPath = path.join(opsEnvDir, ".env.local");
const envPortsPath = path.join(opsEnvDir, ".env.ports");

warn(
  "ops/env/.env.local exists (optional)",
  fs.existsSync(envLocalPath),
  "Run: node scripts/dx/env-compiler.js --mode local --force"
);

check(
  "ops/env/.env.ports exists",
  fs.existsSync(envPortsPath),
  "Run: node scripts/dx/env-compiler.js --mode local --force"
);

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");

  check(
    "DATABASE_URL defined",
    envContent.includes("DATABASE_URL=") && !envContent.includes("DATABASE_URL=\n"),
    "Check .env.local has valid DATABASE_URL"
  );

  check(
    "SUPABASE_URL defined",
    envContent.includes("SUPABASE_URL=") && !envContent.includes("SUPABASE_URL=\n"),
    "Check .env.local has valid SUPABASE_URL"
  );

  check(
    "VITE_SUPABASE_URL defined",
    envContent.includes("VITE_SUPABASE_URL="),
    "Frontend needs VITE_SUPABASE_URL"
  );

  warn(
    "No placeholder values",
    !envContent.includes("replace-with-") && !envContent.includes("your-"),
    "Replace placeholder values in .env.local"
  );
}

// Section 4: Dependencies
log.section("Dependencies");

const nodeModulesPath = path.join(projectRoot, "node_modules");
check("node_modules exists", fs.existsSync(nodeModulesPath), "Run: pnpm install");

const lockfilePath = path.join(projectRoot, "pnpm-lock.yaml");
check(
  "pnpm-lock.yaml exists",
  fs.existsSync(lockfilePath),
  "Run: pnpm install to generate lockfile"
);

// Section 5: Configuration Files
log.section("Configuration");

const configFiles = [
  { path: ".nvmrc", desc: ".nvmrc" },
  { path: "config/ports.json", desc: "ports.json" },
  { path: "infra/supabase/config.toml", desc: "Supabase config" },
];

configFiles.forEach(({ path: filePath, desc }) => {
  check(`${desc} exists`, fs.existsSync(path.join(projectRoot, filePath)), `Missing ${filePath}`);
});

// Summary
console.log(`
╔════════════════════════════════════════════════════════════════╗
║                        Summary                                 ║
╠════════════════════════════════════════════════════════════════╣
║  Passed:   ${String(checks.passed).padEnd(4)}                                             ║
║  Warnings: ${String(checks.warnings).padEnd(4)}                                             ║
║  Failed:   ${String(checks.failed).padEnd(4)}                                             ║
╚════════════════════════════════════════════════════════════════╝
`);

if (checks.failed > 0) {
  console.log(
    `${colors.red}❌ ${checks.failed} check(s) failed. Fix the issues above before running pnpm run dx${colors.reset}`
  );
  process.exit(1);
} else if (checks.warnings > 0) {
  console.log(
    `${colors.yellow}⚠️  ${checks.warnings} warning(s). Environment may work but is not optimal.${colors.reset}`
  );
  process.exit(0);
} else {
  console.log(`${colors.green}✅ All checks passed! Run: pnpm run dx${colors.reset}`);
  process.exit(0);
}
