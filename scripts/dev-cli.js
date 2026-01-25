#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { loadPorts, resolvePort } from "./dx/ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

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
  ./dev reset
  ./dev doctor [--mode local|docker]
  ./dev logs [service] [--mode local|docker]

Flags:
  --mode           Set dx mode (local or docker)
  --seed           Seed database after migrations
  --skip-install   Skip pnpm install step
  --ci             CI mode (less verbose, no prompts)
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

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onFailure = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(500);
    socket.once("error", onFailure);
    socket.once("timeout", onFailure);
    socket.connect(port, "127.0.0.1", () => {
      socket.end();
      resolve(true);
    });
  });
}

async function findNextAvailablePort(startPort) {
  for (let port = startPort + 1; port < startPort + 50; port += 1) {
    if (!(await isPortInUse(port))) {
      return port;
    }
  }
  return null;
}

async function checkPorts() {
  const ports = loadPorts();
  const checks = [
    { label: "Frontend", env: "VITE_PORT", value: resolvePort(process.env.VITE_PORT, ports.frontend.port) },
    { label: "Vite HMR", env: "VITE_HMR_PORT", value: resolvePort(process.env.VITE_HMR_PORT, ports.frontend.hmrPort) },
    { label: "Backend", env: "API_PORT", value: resolvePort(process.env.API_PORT, ports.backend.port) },
    { label: "Postgres", env: "POSTGRES_PORT", value: resolvePort(process.env.POSTGRES_PORT, ports.postgres.port) },
    { label: "Redis", env: "REDIS_PORT", value: resolvePort(process.env.REDIS_PORT, ports.redis.port) },
    { label: "Supabase API", env: "SUPABASE_API_PORT", value: resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort) },
    { label: "Supabase Studio", env: "SUPABASE_STUDIO_PORT", value: resolvePort(process.env.SUPABASE_STUDIO_PORT, ports.supabase.studioPort) },
    { label: "Supabase DB", env: "SUPABASE_DB_PORT", value: resolvePort(process.env.SUPABASE_DB_PORT, ports.supabase.dbPort) },
    { label: "Caddy HTTP", env: "CADDY_HTTP_PORT", value: resolvePort(process.env.CADDY_HTTP_PORT, ports.edge.httpPort) },
    { label: "Caddy HTTPS", env: "CADDY_HTTPS_PORT", value: resolvePort(process.env.CADDY_HTTPS_PORT, ports.edge.httpsPort) },
    { label: "Caddy Admin", env: "CADDY_ADMIN_PORT", value: resolvePort(process.env.CADDY_ADMIN_PORT, ports.edge.adminPort) },
    { label: "Prometheus", env: "PROMETHEUS_PORT", value: resolvePort(process.env.PROMETHEUS_PORT, ports.observability.prometheusPort) },
    { label: "Grafana", env: "GRAFANA_PORT", value: resolvePort(process.env.GRAFANA_PORT, ports.observability.grafanaPort) },
  ];

  const conflicts = [];

  for (const check of checks) {
    if (await isPortInUse(check.value)) {
      const suggestion = await findNextAvailablePort(check.value);
      conflicts.push({ ...check, suggestion });
    }
  }

  if (conflicts.length > 0) {
    console.error("\n❌ Port conflicts detected:");
    conflicts.forEach((conflict) => {
      console.error(
        `   - ${conflict.label} port ${conflict.value} is in use. Set ${conflict.env}=${
          conflict.suggestion || "<free-port>"
        } and re-run.`
      );
    });
    console.error(`\nFix: export overrides then regenerate envs:\n  pnpm run dx:env --mode ${mode} --force\n`);
    process.exit(1);
  }
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
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
    run("node scripts/dx/orchestrator.js --reset");
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

  if (command !== "up") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  ensureNodeVersion();
  ensurePnpm();
  ensureDocker();
  await checkPorts();

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
