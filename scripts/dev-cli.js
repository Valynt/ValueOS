#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { composeCommand, parseComposeProfiles } from "./dx/lib/compose.js";

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
const debug = hasFlag("--debug") || process.env.DX_DEBUG === "1";
const composeProfiles = parseComposeProfiles(rawArgs);
const composeProfileFlags = composeProfiles.map((profile) => `--profile ${profile}`).join(" ");
const pnpmVersion = "9.15.0";

function run(commandLine, options = {}) {
  return execSync(commandLine, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });
}

function runCapture(commandLine) {
  try {
    return execSync(commandLine, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  } catch (error) {
    if (error?.status === 0) {
      return (error.stdout || "").toString().trim();
    }
    throw error;
  }
}

function printHelp() {
  console.log(`
ValueOS Dev CLI - Developer Experience Orchestrator

Usage:
  pnpm run dx [up] [--mode local|docker] [--seed] [--skip-install]
  pnpm run dx:up [--mode local|docker] [--seed]
  pnpm run dx:down
  pnpm run dx:reset [--hard]
  pnpm run dx:doctor [--mode local|docker]
  pnpm run dx:logs [service] [--mode local|docker]
  pnpm run dx:test [--mode local|docker]
  pnpm run dx:lint [--mode local|docker]
  pnpm run dx:build [--mode local|docker]

Orchestration Flow (pnpm run dx:up):
  1. dx:env         - Generate ops/env/.env.local + ops/env/.env.ports from config/ports.json
  2. Preflight      - Docker, Node/pnpm, DATABASE_URL, ports
  3. Docker deps    - Start postgres + redis (docker compose)
  4. Supabase       - Start local Supabase (optional, falls back to dx postgres)
  5. Migrations     - supabase db push against Supabase or dx postgres
  6. Schema verify  - Regenerate TypeScript types (non-critical)
  7. Backend        - tsx watch packages/backend/src/server.ts
  8. Frontend       - pnpm --filter valynt-app dev (Vite)

Recovery/Maintenance:
  pnpm run dx:logs <service>  - Tail logs for a service
  pnpm run dx:down            - Stop stack (Ctrl+C also works)
  pnpm run dx:reset           - Reset stack (remove containers/volumes)
  pnpm run dx:doctor    - Run preflight diagnostics
  pnpm run dx:env:validate  - Validate environment files

Flags:
  --mode           Set dx mode (local or docker)
  --seed           Seed database after migrations
  --skip-install   Skip pnpm install step
  --ci             CI mode (less verbose, no prompts)
  --auto-shift-ports  Auto-shift ports if conflicts are detected
  --hard           Reset tier (soft is default; hard also prunes build cache)
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
  if (expected) {
    const parse = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
    const cmp = (a, b) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const av = a[i] || 0;
        const bv = b[i] || 0;
        if (av > bv) return 1;
        if (av < bv) return -1;
      }
      return 0;
    };

    const expectedParts = parse(expected);
    const actualParts = parse(actual);

    if (cmp(actualParts, expectedParts) < 0) {
      console.error(`❌ Node ${expected} required but found ${actual}.`);
      console.error("   Fix: install the pinned version (nvm install && nvm use) or update .nvmrc.");
      process.exit(1);
    }
    if (cmp(actualParts, expectedParts) > 0) {
      console.warn(`⚠️  Node ${actual} found which is newer than pinned ${expected}; continuing.`);
    }
  }
}

function ensurePnpm() {
  // Corepack defaults to ~/.cache/node/corepack; that path can be readonly in some devcontainers.
  // Force a writable location inside the workspace to avoid EACCES during prepare.
  try {
    const corepackHome = path.join(projectRoot, ".cache", "corepack");
    fs.mkdirSync(corepackHome, { recursive: true, mode: 0o700 });
    process.env.COREPACK_HOME = corepackHome;
  } catch {
    // If we cannot create the directory, fall back to Corepack defaults.
  }

  const detectPnpmVersion = () => {
    try {
      const out = execSync("pnpm -v", {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
      const value = out.toString().trim();
      if (value) return value;
    } catch (error) {
      if (error?.status === 0) {
        const out = (error.stdout || "").toString().trim();
        return out || "unknown";
      }
      return null;
    }
    return null;
  };

  const pnpmExists = () => {
    const entries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    return entries.some((entry) => fs.existsSync(path.join(entry, "pnpm")));
  };

  const existingVersion = detectPnpmVersion();
  if (existingVersion) {
    if (existingVersion === pnpmVersion || existingVersion === "unknown") {
      return; // pnpm is present; either matches or cannot be resolved but we won't block on it.
    }
  } else if (pnpmExists()) {
    console.warn("⚠️  pnpm detected on PATH but version unknown; skipping Corepack.");
    return;
  }

  try {
    run("corepack enable", { stdio: ci ? "ignore" : "inherit" });
    run(`corepack prepare pnpm@${pnpmVersion} --activate`, {
      stdio: ci ? "ignore" : "inherit",
    });
  } catch {
    console.warn("⚠️  Corepack activation failed; falling back to existing pnpm.");
  }

  const actual = detectPnpmVersion();
  if (!actual) {
    console.warn("⚠️  pnpm version could not be detected, but continuing.");
    return;
  }

  if (actual !== pnpmVersion) {
    console.warn(`⚠️  pnpm ${pnpmVersion} expected but found ${actual}.`);
  }
}

function ensureDocker() {
  try {
    runCapture("docker info");
  } catch (error) {
    const message = error?.message || "";
    if (message.toLowerCase().includes("permission denied")) {
      console.error("❌ Docker permission denied. Check /var/run/docker.sock access.");
    } else {
      console.error("❌ Docker is not available. Start Docker Desktop or install Docker Engine.");
    }
    process.exit(1);
  }
}

function loadPortsEnvFile() {
  const portsPath = path.join(projectRoot, "ops", "env", ".env.ports");
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


function logIgnoredFlags(currentCommand) {
  const ignored = [];
  if (currentCommand !== "up" && seed) ignored.push("--seed");
  if (currentCommand !== "reset" && hasFlag("--hard")) ignored.push("--hard");
  if (ignored.length > 0) {
    console.warn(`⚠️  Ignoring ${ignored.join(", ")} for '${currentCommand}' command.`);
  }
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
    logIgnoredFlags("doctor");
    if (debug) {
      process.env.DX_DEBUG = "1";
    }
    run(`node scripts/dx/doctor.js --mode ${mode}`);
    return;
  }

  if (command === "down") {
    logIgnoredFlags("down");
    ensureDocker();
    run(`pnpm exec tsx scripts/dx/orchestrator.js --down${composeProfileFlags ? ` ${composeProfileFlags}` : ""}`);
    return;
  }

  if (command === "reset") {
    logIgnoredFlags("reset");
    ensureDocker();
    const resetFlag = resetLevel === "hard" ? "--reset hard" : "--reset soft";
    run(`pnpm exec tsx scripts/dx/orchestrator.js ${resetFlag}${composeProfileFlags ? ` ${composeProfileFlags}` : ""}`);
    return;
  }

  if (command === "logs") {
    logIgnoredFlags("logs");
    ensureDocker();
    const { command: composeLogsCommand } = composeCommand("logs", {
      mode,
      profiles: composeProfiles,
      extraArgs: ["-f", ...(service ? [service] : [])],
    });
    run(
      composeLogsCommand
    );
    return;
  }

  if (command === "test") {
    ensureNodeVersion();
    ensurePnpm();
    logIgnoredFlags("test");
    run("pnpm test");
    return;
  }

  if (command === "lint") {
    ensureNodeVersion();
    ensurePnpm();
    logIgnoredFlags("lint");
    run("pnpm run lint");
    return;
  }

  if (command === "build") {
    ensureNodeVersion();
    ensurePnpm();
    logIgnoredFlags("build");
    run("pnpm run build");
    return;
  }

  if (command !== "up") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  ensureNodeVersion();
  ensurePnpm();
  if (debug) {
    process.env.DX_DEBUG = "1";
  }
  run(`node scripts/dx/env-compiler.js --mode ${mode} --force`);
  run(`node scripts/dx/doctor.js --mode ${mode}${autoShiftPorts ? " --auto-shift-ports" : ""}`);
  applyPortsEnvOverrides();
  ensureDocker();

  if (!skipInstall) {
    run("pnpm install --frozen-lockfile --prefer-offline");
  }

  // Verify build configuration resolution (aliases, etc.)
  run("pnpm run verify:resolution");

  process.env.DOCKER_BUILDKIT = "1";
  process.env.COMPOSE_DOCKER_CLI_BUILD = "1";

  const modeFlag = mode === "docker" ? "--mode docker" : "--mode local";
  const seedFlag = seed ? " --seed" : "";
  run(`pnpm exec tsx scripts/dx/orchestrator.js ${modeFlag}${seedFlag}${composeProfileFlags ? ` ${composeProfileFlags}` : ""}`);
}

main().catch((error) => {
  console.error(`❌ dev CLI failed: ${error.message}`);
  process.exit(1);
});
