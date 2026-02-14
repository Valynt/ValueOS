#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const command = process.argv[2] || "up";
const args = process.argv.slice(3);

function getFlagValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("-")) return null;
  return value;
}

function resolveMode() {
  const explicitMode = getFlagValue("--mode") || process.env.npm_config_mode || process.env.DX_MODE;
  const mode = (explicitMode || "local").toLowerCase();
  if (!["local", "docker"].includes(mode)) {
    console.error(`❌ Unsupported mode '${mode}'. Use --mode local or --mode docker.`);
    process.exit(1);
  }
  return mode;
}

function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: projectRoot,
    stdio: "inherit",
    ...opts,
  });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...opts,
  }).trim();
}

function ensureDocker() {
  try {
    runCapture("docker info");
  } catch {
    console.error("❌ Docker is required but not available. Start Docker Desktop/Engine and retry.");
    process.exit(1);
  }
}

function loadEnvFiles() {
  const env = { ...process.env };
  const candidates = [
    path.join(projectRoot, "ops", "env", ".env.local"),
    path.join(projectRoot, ".env.local"),
    path.join(projectRoot, ".env"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (!(key in env)) env[key] = value;
    }
  }

  return env;
}

function ensureRequiredEnv(mode) {
  const env = loadEnvFiles();
  const required = ["POSTGRES_PASSWORD", "REDIS_PASSWORD"];
  const missing = required.filter((name) => !env[name]);

  if (missing.length > 0) {
    console.error(`❌ Missing required env var(s) for dx:${command} --mode ${mode}: ${missing.join(", ")}`);
    console.error("   Fix: set them in ops/env/.env.local (preferred) or export them in your shell.");
    process.exit(1);
  }
}

function composeBaseArgs() {
  const envLocal = path.join("ops", "env", ".env.local");
  const envPorts = path.join("ops", "env", ".env.ports");
  const args = ["--project-directory ."];
  if (fs.existsSync(path.join(projectRoot, envLocal))) args.push(`--env-file ${envLocal}`);
  if (fs.existsSync(path.join(projectRoot, envPorts))) args.push(`--env-file ${envPorts}`);
  args.push("-f ops/compose/compose.yml");
  return args.join(" ");
}

function waitForHealthy(services, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    let allHealthy = true;
    for (const service of services) {
      const id = runCapture(`docker compose ${composeBaseArgs()} ps -q ${service}`);
      if (!id) {
        allHealthy = false;
        break;
      }
      const health = runCapture(
        `docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ${id}`
      ).replace(/'/g, "");
      if (!["healthy", "running"].includes(health)) {
        allHealthy = false;
        break;
      }
    }
    if (allHealthy) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }

  console.error("❌ Timed out waiting for runtime services to become healthy.");
  process.exit(1);
}

function upLocal() {
  console.log("▶ dx:up local | profile: deps (postgres, redis)");
  run(`node scripts/dx/doctor.js --mode local --soft`);
  run(`docker compose ${composeBaseArgs()} up -d postgres redis`);

  const postgresPort = process.env.POSTGRES_PORT || "5432";
  const redisPort = process.env.REDIS_PORT || "6379";
  console.log("✓ Dependencies started");
  console.log(`  - postgres: localhost:${postgresPort}`);
  console.log(`  - redis:    localhost:${redisPort}`);
  console.log("Next steps:");
  console.log("  1) pnpm --filter @valueos/backend dev");
  console.log("  2) pnpm --filter valynt-app dev");
}

function upDocker() {
  console.log("▶ dx:up docker | profile: runtime-docker + deps");
  run(`node scripts/dx/doctor.js --mode docker --soft`);
  const cmd = `docker compose ${composeBaseArgs()} -f ops/compose/profiles/runtime-docker.yml --profile runtime-docker up -d postgres redis zookeeper kafka schema-registry backend worker frontend`;
  run(cmd);
  waitForHealthy(["postgres", "redis", "backend", "frontend"]);

  const webPort = process.env.WEB_PORT || "5173";
  const apiPort = process.env.API_PORT || "3001";
  const pgPort = process.env.POSTGRES_PORT || "5432";
  const redisPort = process.env.REDIS_PORT || "6379";
  console.log("✓ Runtime stack healthy");
  console.log(`  - frontend: http://localhost:${webPort}`);
  console.log(`  - backend:  http://localhost:${apiPort}`);
  console.log(`  - postgres: localhost:${pgPort}`);
  console.log(`  - redis:    localhost:${redisPort}`);
}

function downLocal() {
  console.log("▶ dx:down local | stopping deps resources");
  run(`docker compose ${composeBaseArgs()} stop postgres redis`);
  run(`docker compose ${composeBaseArgs()} rm -f postgres redis`);
  console.log("✓ Stopped local deps resources (postgres, redis)");
}

function downDocker() {
  console.log("▶ dx:down docker | stopping runtime-docker + deps resources");
  const cmdBase = `docker compose ${composeBaseArgs()} -f ops/compose/profiles/runtime-docker.yml --profile runtime-docker`;
  run(`${cmdBase} stop frontend backend worker schema-registry kafka zookeeper postgres redis`);
  run(`${cmdBase} rm -f frontend backend worker schema-registry kafka zookeeper postgres redis`);
  console.log("✓ Stopped docker runtime resources (runtime-docker + deps)");
}

function main() {
  const mode = resolveMode();
  ensureDocker();
  ensureRequiredEnv(mode);

  if (command === "up") {
    if (mode === "local") upLocal();
    else upDocker();
    return;
  }

  if (command === "down") {
    if (mode === "local") downLocal();
    else downDocker();
    return;
  }

  console.error(`❌ Unsupported command '${command}'. Use 'up' or 'down'.`);
  process.exit(1);
}

main();
