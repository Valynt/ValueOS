#!/usr/bin/env tsx
/**
 * dev:verify - Readiness Gates for ValueOS Development Environment
 *
 * This script validates that the development environment is correctly set up
 * and all core services are accessible. It is the authoritative "it works" proof.
 *
 * Tiers:
 *   Tier 0: Infrastructure (containers running, DB accessible, Kong responding)
 *   Tier 1: Application (migrations applied, dev server can start)
 *   Tier 2: Quality (typecheck tracked, islands clean - signals only)
 *
 * Usage:
 *   pnpm run dev:verify           # Full verification
 *   pnpm run dev:verify --tier=0  # Infrastructure only
 *   pnpm run dev:verify --quick   # Fast checks only
 */

import { execSync, spawn } from "child_process";
import * as http from "http";
import * as net from "net";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Configuration
const CONFIG = {
  // Container names we expect to be running
  requiredContainers: [
    "valueos-db",
    "valueos-kong",
    "valueos-auth",
    "valueos-rest",
    "valueos-storage",
    "valueos-meta",
  ],
  // Database connection (use container name for devcontainer networking)
  db: {
    host: process.env.DB_HOST || "db",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "postgres",
  },
  // Kong API Gateway
  kong: {
    host: process.env.KONG_HOST || "valueos-kong",
    port: parseInt(process.env.KONG_PORT || "8000", 10),
  },
  // Frontend dev server
  frontend: {
    host: "localhost",
    port: parseInt(process.env.VITE_PORT || "5173", 10),
  },
  // Timeouts
  httpTimeout: 5000,
  dbTimeout: 5000,
};

interface CheckResult {
  name: string;
  tier: number;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: CheckResult[] = [];
let hasFailure = false;

// Logging utilities
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(check: CheckResult): void {
  const icon = check.passed ? `${colors.green}✓` : `${colors.red}✗`;
  const tier = `${colors.dim}[T${check.tier}]${colors.reset}`;
  const duration = check.duration ? ` ${colors.dim}(${check.duration}ms)${colors.reset}` : "";
  console.log(`${icon}${colors.reset} ${tier} ${check.name}: ${check.message}${duration}`);

  if (!check.passed) {
    hasFailure = true;
  }
  results.push(check);
}

// Check utilities
function runCommand(cmd: string, silent = true): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: silent ? ["pipe", "pipe", "pipe"] : "inherit",
    });
    return { success: true, output: output || "" };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      output: execError.stdout || execError.stderr || execError.message || "Unknown error",
    };
  }
}

function checkTcpPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function checkHttpEndpoint(
  host: string,
  port: number,
  path: string,
  timeout: number
): Promise<{ success: boolean; statusCode?: number }> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path,
        method: "GET",
        timeout,
      },
      (res) => {
        resolve({
          success: res.statusCode !== undefined && res.statusCode < 500,
          statusCode: res.statusCode,
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false });
    });

    req.on("error", () => {
      resolve({ success: false });
    });

    req.end();
  });
}

// Tier 0: Infrastructure Checks
async function checkDockerContainers(): Promise<void> {
  const start = Date.now();
  const { success, output } = runCommand("docker ps --format '{{.Names}}:{{.Status}}'");

  if (!success) {
    log({
      name: "Docker",
      tier: 0,
      passed: false,
      message: "Docker daemon not accessible",
      duration: Date.now() - start,
    });
    return;
  }

  const runningContainers = output.split("\n").filter(Boolean);
  const healthyContainers: string[] = [];
  const unhealthyContainers: string[] = [];

  for (const container of CONFIG.requiredContainers) {
    const containerLine = runningContainers.find((line) => line.startsWith(container + ":"));
    if (containerLine && containerLine.includes("Up")) {
      healthyContainers.push(container);
    } else {
      unhealthyContainers.push(container);
    }
  }

  if (unhealthyContainers.length === 0) {
    log({
      name: "Docker Containers",
      tier: 0,
      passed: true,
      message: `All ${healthyContainers.length} required containers running`,
      duration: Date.now() - start,
    });
  } else {
    log({
      name: "Docker Containers",
      tier: 0,
      passed: false,
      message: `Missing: ${unhealthyContainers.join(", ")}`,
      duration: Date.now() - start,
    });
  }
}

async function checkDatabaseConnectivity(): Promise<void> {
  const start = Date.now();
  const hosts = Array.from(new Set([CONFIG.db.host, "db", "valueos-db"]));

  for (const host of hosts) {
    const tcpOk = await checkTcpPort(host, CONFIG.db.port, CONFIG.dbTimeout);
    if (!tcpOk) {
      continue;
    }

    const { success, output } = runCommand(
      `PGPASSWORD=${CONFIG.db.password} psql -h ${host} -p ${CONFIG.db.port} ` +
        `-U ${CONFIG.db.user} -d ${CONFIG.db.database} -c "SELECT 1;" -t -A`
    );

    if (success && output.trim() === "1") {
      log({
        name: "Database Connectivity",
        tier: 0,
        passed: true,
        message: `Connected to ${host}:${CONFIG.db.port}`,
        duration: Date.now() - start,
      });
      return;
    }
  }

  log({
    name: "Database Connectivity",
    tier: 0,
    passed: false,
    message: `Cannot run SELECT 1 on any host candidate (${hosts.join(", ")})`,
    duration: Date.now() - start,
  });
}

async function checkKongGateway(): Promise<void> {
  const start = Date.now();
  const endpoints = ["/auth/v1/health", "/rest/v1/"];
  for (const endpoint of endpoints) {
    const result = await checkHttpEndpoint(
      CONFIG.kong.host,
      CONFIG.kong.port,
      endpoint,
      CONFIG.httpTimeout
    );
    if (!result.success) {
      continue;
    }

    log({
      name: "Kong API Gateway",
      tier: 0,
      passed: true,
      message:
        `Responding on ${CONFIG.kong.host}:${CONFIG.kong.port}${endpoint} ` +
        `(HTTP ${result.statusCode})`,
      duration: Date.now() - start,
    });
    return;
  }

  const kongHealth = runCommand("docker exec valueos-kong kong health");
  if (kongHealth.success) {
    log({
      name: "Kong API Gateway",
      tier: 0,
      passed: true,
      message: "Kong process healthy (HTTP probe unavailable from current network)",
      duration: Date.now() - start,
    });
    return;
  }

  log({
    name: "Kong API Gateway",
    tier: 0,
    passed: false,
    message: `Not responding on ${CONFIG.kong.host}:${CONFIG.kong.port}`,
    duration: Date.now() - start,
  });
}

// Tier 1: Application Checks
async function checkMigrations(): Promise<void> {
  const start = Date.now();
  const { success, output } = runCommand(
    `PGPASSWORD=${CONFIG.db.password} psql -h ${CONFIG.db.host} -p ${CONFIG.db.port} ` +
      `-U ${CONFIG.db.user} -d ${CONFIG.db.database} -t -A -c "` +
      "SELECT 'supabase', COUNT(*) FROM supabase_migrations.schema_migrations " +
      "UNION ALL SELECT 'public', COUNT(*) FROM public.schema_migrations;\""
  );

  if (!success) {
    log({
      name: "Database Migrations",
      tier: 1,
      passed: false,
      message: "Could not read migration tables",
      duration: Date.now() - start,
    });
    return;
  }

  const counts = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, number>>((acc, line) => {
      const [name, value] = line.split("|").map((part) => part.trim());
      if (name && value) {
        acc[name] = parseInt(value, 10);
      }
      return acc;
    }, {});

  const supabaseCount = counts.supabase ?? 0;
  const publicCount = counts.public ?? 0;
  const appliedCount = Math.max(supabaseCount, publicCount);

  if (appliedCount > 0) {
    log({
      name: "Database Migrations",
      tier: 1,
      passed: true,
      message: `${appliedCount} migrations recorded (supabase=${supabaseCount}, public=${publicCount})`,
      duration: Date.now() - start,
    });
    return;
  }

  log({
    name: "Database Migrations",
    tier: 1,
    passed: false,
    message: "No migrations found - run db:push",
    duration: Date.now() - start,
  });
}

async function checkFrontendReadiness(): Promise<void> {
  const start = Date.now();

  // Check if Vite config exists and is valid
  const { success: configExists } = runCommand("test -f apps/ValyntApp/vite.config.ts");

  if (!configExists) {
    log({
      name: "Vite Configuration",
      tier: 1,
      passed: false,
      message: "vite.config.ts not found in apps/ValyntApp",
      duration: Date.now() - start,
    });
    return;
  }

  // Check if node_modules are installed
  const { success: modulesExist } = runCommand("test -d node_modules/.pnpm");

  if (!modulesExist) {
    log({
      name: "Dependencies",
      tier: 1,
      passed: false,
      message: "node_modules not installed - run pnpm install",
      duration: Date.now() - start,
    });
    return;
  }

  const candidatePorts = [CONFIG.frontend.port, 5174, 5175, 5176];
  for (const port of candidatePorts) {
    const result = await checkHttpEndpoint(CONFIG.frontend.host, port, "/", CONFIG.httpTimeout);
    if (!result.success) {
      continue;
    }

    log({
      name: "Frontend Readiness",
      tier: 1,
      passed: true,
      message: `Frontend responds on http://${CONFIG.frontend.host}:${port} (HTTP ${result.statusCode})`,
      duration: Date.now() - start,
    });
    return;
  }

  log({
    name: "Frontend Readiness",
    tier: 1,
    passed: false,
    message:
      "Frontend is not serving HTTP. Start it with: pnpm dev",
    duration: Date.now() - start,
  });
}

// Tier 2: Quality Signals (informational)
async function checkTypescriptSignal(): Promise<void> {
  const start = Date.now();

  const { output } = runCommand("pnpm run typecheck:app 2>&1 | grep -c 'error TS' || echo '0'");
  const errorCount = parseInt(output.trim(), 10);

  // This is informational - we don't fail on typecheck errors
  log({
    name: "TypeScript Errors (signal)",
    tier: 2,
    passed: true, // Always pass - this is a signal, not a gate
    message: `${errorCount.toLocaleString()} errors (tracking only)`,
    duration: Date.now() - start,
  });
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const tierArg = args.find((a) => a.startsWith("--tier="));
  const maxTier = tierArg ? parseInt(tierArg.split("=")[1] || "2", 10) : 2;
  const quick = args.includes("--quick");

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║              ValueOS Development Verification              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`${colors.cyan}Tier 0: Infrastructure${colors.reset}`);
  console.log("─".repeat(50));
  await checkDockerContainers();
  await checkDatabaseConnectivity();
  await checkKongGateway();

  if (maxTier >= 1) {
    console.log(`\n${colors.cyan}Tier 1: Application${colors.reset}`);
    console.log("─".repeat(50));
    await checkMigrations();
    await checkFrontendReadiness();
  }

  if (maxTier >= 2 && !quick) {
    console.log(`\n${colors.cyan}Tier 2: Quality Signals${colors.reset}`);
    console.log("─".repeat(50));
    await checkTypescriptSignal();
  }

  // Summary
  console.log("\n" + "═".repeat(50));
  const tier0Results = results.filter((r) => r.tier === 0);
  const tier1Results = results.filter((r) => r.tier === 1);
  const tier0Pass = tier0Results.every((r) => r.passed);
  const tier1Pass = tier1Results.every((r) => r.passed);

  if (tier0Pass && tier1Pass) {
    console.log(`${colors.green}✓ All checks passed!${colors.reset} Environment is ready.`);
    console.log(`\nRun ${colors.cyan}pnpm dev${colors.reset} to start developing.\n`);
    process.exit(0);
  } else {
    const failures = results.filter((r) => !r.passed && r.tier <= 1);
    console.log(`${colors.red}✗ ${failures.length} check(s) failed${colors.reset}`);

    if (!tier0Pass) {
      console.log(`\n${colors.yellow}Infrastructure issues detected:${colors.reset}`);
      console.log("  • Ensure Docker containers are running: docker compose up -d");
      console.log("  • Check container logs: docker compose logs -f");
    }

    if (!tier1Pass) {
      console.log(`\n${colors.yellow}Application issues detected:${colors.reset}`);
      console.log("  • Install dependencies: pnpm install");
      console.log("  • Apply migrations: pnpm run db:push");
    }

    console.log("");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("dev:verify failed:", err);
  process.exit(1);
});
