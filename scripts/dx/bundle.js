#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { buildComposeArgs } from "./compose.js";
import { resolveMode } from "./lib/mode.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
let mode = "local";
try {
  mode = resolveMode(args);
} catch {
  mode = "local";
}

function run(command, options = {}) {
  return execSync(command, {
    cwd: projectRoot,
    stdio: options.silent ? "pipe" : "inherit",
    encoding: "utf8",
    ...options,
  });
}

function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function collectEnvKeys() {
  const envPath = fs.existsSync(path.join(projectRoot, ".env.local"))
    ? path.join(projectRoot, ".env.local")
    : path.join(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    return "No .env.local or .env found.";
  }

  const keys = fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0])
    .filter(Boolean);

  return keys.sort().join("\n");
}

function createBundle() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bundleDir = path.join(projectRoot, ".dx-bundles", `support-${timestamp}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  writeFileSafe(path.join(bundleDir, "system.txt"), [
    `Timestamp: ${new Date().toISOString()}`,
    `Host: ${os.hostname()}`,
    `Platform: ${process.platform}`,
    `Arch: ${process.arch}`,
    `Node: ${process.version}`,
    `Mode: ${mode}`,
  ].join("\n"));

  writeFileSafe(path.join(bundleDir, "env-keys.txt"), collectEnvKeys());

  try {
    const doctor = run(
      `DX_DOCTOR_ALLOW_PLACEHOLDERS=1 DX_SOFT_DOCTOR=1 node scripts/dx/doctor.js --mode ${mode}`,
      { silent: true }
    );
    writeFileSafe(path.join(bundleDir, "doctor.txt"), doctor);
  } catch (error) {
    writeFileSafe(
      path.join(bundleDir, "doctor.txt"),
      error.stdout || error.message || "doctor failed"
    );
  }

  try {
    const ps = run(
      `docker compose ${buildComposeArgs({ projectDir: projectRoot, files: ["ops/compose/dev.yml"] }).join(" ")} ps`,
      { silent: true }
    );
    writeFileSafe(path.join(bundleDir, "compose-dev-ps.txt"), ps);
  } catch (error) {
    writeFileSafe(
      path.join(bundleDir, "compose-dev-ps.txt"),
      error.stdout || error.message || "compose dev ps failed"
    );
  }

  try {
    const depsPs = run(
      `docker compose ${buildComposeArgs({ projectDir: projectRoot, files: ["ops/compose/core.yml"] }).join(" ")} ps`,
      { silent: true }
    );
    writeFileSafe(path.join(bundleDir, "compose-deps-ps.txt"), depsPs);
  } catch (error) {
    writeFileSafe(
      path.join(bundleDir, "compose-deps-ps.txt"),
      error.stdout || error.message || "compose deps ps failed"
    );
  }

  try {
    const logs = run(
      `docker compose ${buildComposeArgs({ projectDir: projectRoot, files: ["ops/compose/dev.yml"] }).join(" ")} logs --tail 50`,
      { silent: true }
    );
    writeFileSafe(path.join(bundleDir, "compose-dev-logs.txt"), logs);
  } catch (error) {
    writeFileSafe(
      path.join(bundleDir, "compose-dev-logs.txt"),
      error.stdout || error.message || "compose dev logs failed"
    );
  }

  const archive = path.join(projectRoot, ".dx-bundles", `support-${timestamp}.tar.gz`);
  run(`tar -czf ${archive} -C ${bundleDir} .`, { silent: true });

  console.log(`\n✅ Support bundle created: ${archive}\n`);
}

createBundle();
