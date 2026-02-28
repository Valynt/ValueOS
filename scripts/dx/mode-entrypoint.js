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
  const explicitMode = getFlagValue("--mode") || process.env.npm_config_mode || process.env.APP_ENV;
  const mode = (explicitMode || "local").toLowerCase();
  if (!["local", "cloud-dev"].includes(mode)) {
    console.error(`❌ Unsupported mode '${mode}'. Use --mode local or --mode cloud-dev.`);
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

function loadEnvFiles(mode) {
  const env = { ...process.env };
  const candidates = [
    path.join(projectRoot, "ops", "env", `.env.${mode}`),
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
  const env = loadEnvFiles(mode);
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "BACKEND_PORT", "FRONTEND_PORT"];
  if (mode === "cloud-dev") required.push("SUPABASE_PROJECT_REF");

  const missing = required.filter((name) => !env[name]);
  if (!env.DATABASE_URL && !(env.PGHOST && env.PGPORT && env.PGDATABASE && env.PGUSER && env.PGPASSWORD)) {
    missing.push("DATABASE_URL");
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required env var(s) for dx:${command} --mode ${mode}: ${missing.join(", ")}`);
    console.error(`   Expected file: ops/env/.env.${mode}`);
    console.error(`   Fix: cp ops/env/.env.local.example ops/env/.env.${mode} and populate missing values.`);
    process.exit(1);
  }
}

function composeBaseArgs(mode) {
  const modeFile = path.join("ops", "env", `.env.${mode}`);
  const envLocal = path.join("ops", "env", ".env.local");
  const envPorts = path.join("ops", "env", ".env.ports");
  const args = ["--project-directory ."];
  if (fs.existsSync(path.join(projectRoot, modeFile))) args.push(`--env-file ${modeFile}`);
  if (fs.existsSync(path.join(projectRoot, envLocal))) args.push(`--env-file ${envLocal}`);
  if (fs.existsSync(path.join(projectRoot, envPorts))) args.push(`--env-file ${envPorts}`);
  args.push("-f ops/compose/compose.yml");
  return args.join(" ");
}

function waitForHealthy(services, mode, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    let allHealthy = true;
    for (const service of services) {
      const id = runCapture(`docker compose ${composeBaseArgs(mode)} ps -q ${service}`);
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

function upLocal(mode) {
  console.log("▶ dx:up local | profile: deps (postgres, redis)");
  run(`docker compose ${composeBaseArgs(mode)} up -d postgres redis`);
  console.log("✓ Dependencies started");
}

function upCloudDev(mode) {
  console.log("▶ dx:up cloud-dev | profile: runtime-docker + deps");
  const cmd = `docker compose ${composeBaseArgs(mode)} -f ops/compose/profiles/runtime-docker.yml --profile runtime-docker up -d postgres redis zookeeper kafka schema-registry backend worker frontend`;
  run(cmd);
  waitForHealthy(["postgres", "redis", "backend", "frontend"], mode);

  const env = loadEnvFiles(mode);
  console.log("✓ Runtime stack healthy");
  console.log(`  - frontend: http://localhost:${env.FRONTEND_PORT}`);
  console.log(`  - backend:  http://localhost:${env.BACKEND_PORT}`);
}

function downLocal(mode) {
  console.log("▶ dx:down local | stopping deps resources");
  run(`docker compose ${composeBaseArgs(mode)} stop postgres redis`);
  run(`docker compose ${composeBaseArgs(mode)} rm -f postgres redis`);
  console.log("✓ Stopped local deps resources (postgres, redis)");
}

function downCloudDev(mode) {
  console.log("▶ dx:down cloud-dev | stopping runtime resources");
  const cmdBase = `docker compose ${composeBaseArgs(mode)} -f ops/compose/profiles/runtime-docker.yml --profile runtime-docker`;
  run(`${cmdBase} stop frontend backend worker schema-registry kafka zookeeper postgres redis`);
  run(`${cmdBase} rm -f frontend backend worker schema-registry kafka zookeeper postgres redis`);
  console.log("✓ Stopped cloud-dev docker resources");
}

function main() {
  const mode = resolveMode();
  ensureDocker();
  ensureRequiredEnv(mode);

  if (command === "up") {
    if (mode === "local") upLocal(mode);
    else upCloudDev(mode);
    return;
  }

  if (command === "down") {
    if (mode === "local") downLocal(mode);
    else downCloudDev(mode);
    return;
  }

  console.error(`❌ Unsupported command '${command}'. Use 'up' or 'down'.`);
  process.exit(1);
}

main();
