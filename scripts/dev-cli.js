#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

process.env.PATH = `${path.join(projectRoot, "node_modules", ".bin")}${path.delimiter}${process.env.PATH}`;

const rawArgs = process.argv.slice(2);
const command = rawArgs[0] && !rawArgs[0].startsWith("-") ? rawArgs.shift() : "up";
const service =
  command === "logs" && rawArgs[0] && !rawArgs[0].startsWith("-") ? rawArgs.shift() : null;

function hasFlag(flag) {
  return rawArgs.includes(flag);
}

function getFlagValue(flag) {
  const index = rawArgs.indexOf(flag);
  if (index === -1) return null;
  const value = rawArgs[index + 1];
  if (!value || value.startsWith("-")) return null;
  return value;
}

const mode = getFlagValue("--mode") || process.env.DX_MODE || "local";
const seed = hasFlag("--seed");
const skipInstall = hasFlag("--skip-install") || process.env.DX_SKIP_INSTALL === "true";
const ci = hasFlag("--ci") || process.env.CI === "true";
const autoShiftPorts = hasFlag("--auto-shift-ports") || process.env.DX_AUTO_SHIFT_PORTS === "1";
const resetLevel = hasFlag("--hard") ? "hard" : "soft";
const pnpmVersion = "9.15.0";

function run(commandLine, options = {}) {
  return execSync(commandLine, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });
}

function runCapture(commandLine) {
  return execSync(commandLine, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

function printHelp() {
  console.log(`
ValueOS Dev CLI

Usage:
  ./dev up [--mode local|docker] [--seed] [--skip-install]
  ./dev down
  ./dev reset [--soft|--hard]
  ./dev doctor [--mode local|docker]
  ./dev logs [service] [--mode local|docker]
  ./dev smoke-test [--mode local|docker]
  ./dev bundle [--mode local|docker]

Flags:
  --mode           Set dx mode (local or docker)
  --seed           Seed database after migrations
  --skip-install   Skip pnpm install step
  --ci             CI mode (less verbose, no prompts)
  --auto-shift-ports  Auto-shift ports if conflicts are detected
  --soft/--hard    Reset tier (soft removes containers + volumes, hard also prunes build cache)
`);
}

function ensureNodeVersion() {
  const nvmrcPath = path.join(projectRoot, ".nvmrc");
  if (!fs.existsSync(nvmrcPath)) {
    console.warn("⚠️  .nvmrc not found. Skipping Node version check.");
    return;
  }

  const expected = fs.readFileSync(nvmrcPath, "utf8").trim().replace(/^v/, "");
  const actual = process.versions.node;

  if (expected && expected !== actual) {
    console.error(`❌ Node ${expected} required but found ${actual}.`);
    console.error("   Fix: install the pinned version (nvm install && nvm use) or update .nvmrc.");
    process.exit(1);
  }
}

function ensurePnpm() {
  run("corepack enable", { stdio: ci ? "ignore" : "inherit" });
  run(`corepack prepare pnpm@${pnpmVersion} --activate`, {
    stdio: ci ? "ignore" : "inherit",
  });

  const actual = runCapture("pnpm -v");
  if (actual !== pnpmVersion) {
    console.warn(`⚠️  pnpm ${pnpmVersion} expected but found ${actual}.`);
  }
}

function ensureDocker() {
  try {
    runCapture("docker info");
  } catch (error) {
    console.error("❌ Docker is not available. Start Docker Desktop or install Docker Engine.");
    process.exit(1);
  }
}

function loadPortsEnvFile() {
  const portsPath = path.join(projectRoot, ".env.ports");
  if (!fs.existsSync(portsPath)) {
    return {};
  }

  const content = fs.readFileSync(portsPath, "utf8");
  const env = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...rest] = trimmed.split("=");
    if (!key) return;
    env[key.trim()] = rest.join("=").trim();
  });

  return env;
}

function applyPortsEnvOverrides() {
  const portsEnv = loadPortsEnvFile();
  Object.entries(portsEnv).forEach(([key, value]) => {
    if (key.endsWith("_PORT") || key === "VITE_HMR_PORT") {
      process.env[key] = value;
    }
  });
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  // Hard-ban DX in CI builds
  if (process.env.CI === "true") {
    console.error("❌ DX must not run in CI. Use setup:ci and build commands instead.");
    process.exit(1);
  }

  if (command === "doctor") {
    ensureNodeVersion();
    ensurePnpm();
    run(`node scripts/dx/doctor.js --mode ${mode}`);
    return;
  }

  if (command === "down") {
    ensureDocker();
    run("node scripts/dx/orchestrator.js --down");
    return;
  }

  if (command === "reset") {
    ensureDocker();
    const resetFlag = resetLevel === "hard" ? "--reset hard" : "--reset soft";
    run(`node scripts/dx/orchestrator.js ${resetFlag}`);
    return;
  }

  if (command === "logs") {
    ensureDocker();
    const composeFile =
      mode === "docker" ? "infra/docker/docker-compose.dev.yml" : "docker-compose.deps.yml";
    run(
      `docker compose --env-file .env.ports -f ${composeFile} logs -f${service ? ` ${service}` : ""}`
    );
    return;
  }

  if (command === "bundle") {
    ensureNodeVersion();
    ensurePnpm();
    run(`node scripts/dx/bundle.js --mode ${mode}`);
    return;
  }

  if (command === "smoke-test") {
    ensureNodeVersion();
    ensurePnpm();
    run(`node scripts/dx/smoke-test.js --mode ${mode}`);
    return;
  }

  if (command !== "up") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  ensureNodeVersion();
  ensurePnpm();
  run(`node scripts/dx/doctor.js --mode ${mode}${autoShiftPorts ? " --auto-shift-ports" : ""}`);
  applyPortsEnvOverrides();
  ensureDocker();

  if (!skipInstall) {
    run("pnpm install --frozen-lockfile --prefer-offline");
  }

  process.env.DOCKER_BUILDKIT = "1";
  process.env.COMPOSE_DOCKER_CLI_BUILD = "1";

  const modeFlag = mode === "docker" ? "--mode docker" : "--mode local";
  const seedFlag = seed ? " --seed" : "";
  run(`node scripts/dx/orchestrator.js ${modeFlag}${seedFlag}`);
}

main().catch((error) => {
  console.error(`❌ dev CLI failed: ${error.message}`);
  process.exit(1);
});
