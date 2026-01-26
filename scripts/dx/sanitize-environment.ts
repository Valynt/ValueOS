#!/usr/bin/env tsx
/**
 * Pre-flight environment sanitization
 * Cleans stale state and checks for port conflicts before DX startup
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(msg: string, color?: string) {
  console.log(`${color || ""}${msg}${colors.reset}`);
}

function runCommand(command: string): string {
  try {
    return execSync(command, { encoding: "utf8", stdio: "pipe" });
  } catch {
    return "";
  }
}

/**
 * Check if ports are in use
 */
function checkPorts(): boolean {
  const ports = [3001, 5173, 5432, 6379, 54321, 54322, 54323];
  const conflicts: Array<{ port: number; process: string }> = [];

  for (const port of ports) {
    const result = runCommand(`lsof -ti:${port} 2>/dev/null || true`).trim();
    if (result) {
      const pids = result.split("\n");
      for (const pid of pids) {
        if (pid) {
          const procName = runCommand(`ps -p ${pid} -o comm= 2>/dev/null || echo "unknown"`).trim();
          conflicts.push({ port, process: `${procName} (PID ${pid})` });
        }
      }
    }
  }

  if (conflicts.length > 0) {
    log("\n⚠️  Port conflicts detected:\n", colors.yellow);
    for (const conflict of conflicts) {
      log(`   Port ${conflict.port}: ${conflict.process}`, colors.red);
      log(`   Fix: kill -9 ${conflict.process.match(/\d+/)?.[0] || "PID"}`, colors.blue);
    }
    log("");
    return false;
  }

  log("✅ All required ports are available", colors.green);
  return true;
}

/**
 * Clean stale state files
 */
function cleanStateFiles(): void {
  const stateFiles = [
    ".dx-lock",
    ".dx-state.json",
    ".dx-checkpoints.json",
    ".dx-trace.log",
  ];

  let cleaned = 0;
  for (const file of stateFiles) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log(`🧹 Cleaned ${cleaned} stale state files`, colors.green);
  }
}

/**
 * Stop and remove orphan containers
 */
function cleanOrphanContainers(): void {
  log("🐳 Cleaning orphan containers...", colors.blue);

  const composeFiles = [
    "docker-compose.deps.yml",
    "infra/supabase/docker-compose.yml",
    "infra/docker/docker-compose.dev.yml",
  ];

  for (const file of composeFiles) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      runCommand(`docker compose -f ${filePath} down --remove-orphans 2>/dev/null || true`);
    }
  }

  log("✅ Orphan containers cleaned", colors.green);
}

/**
 * Main sanitization function
 */
export async function sanitizeEnvironment(options: { force?: boolean } = {}): Promise<boolean> {
  log("\n🧼 Sanitizing environment...\n", colors.yellow);

  cleanStateFiles();

  if (options.force) {
    cleanOrphanContainers();
  }

  const portsOk = checkPorts();

  log("");
  return portsOk;
}

// Run sanitization if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes("--force");
  sanitizeEnvironment({ force })
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      log(`\n❌ Sanitization failed: ${error.message}`, colors.red);
      process.exit(1);
    });
}
