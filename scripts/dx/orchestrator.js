#!/usr/bin/env node

/**
 * DX Orchestrator
 *
 * Single entry point for the development environment.
 * Handles the full lifecycle in the correct order:
 *
 * 1. Compile environment (mode-correct URLs)
 * 2. Start Docker dependencies (Postgres, Redis)
 * 3. Start/verify Supabase
 * 4. Run migrations
 * 5. Seed database (optional)
 * 6. Start backend
 * 7. Wait for backend health
 * 8. Start frontend
 *
 * Usage:
 *   node scripts/dx/orchestrator.js --mode local
 *   node scripts/dx/orchestrator.js --mode docker
 *   node scripts/dx/orchestrator.js --down
 *   node scripts/dx/orchestrator.js --reset
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveMode } from "./lib/mode.js";
import { loadPorts, resolvePort, writePortsEnvFile } from "./ports.js";
import { writeEnvFiles, validateEnvLocal } from "./env-compiler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}▶${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  step: (num, msg) =>
    console.log(`\n${colors.cyan}[${num}]${colors.reset} ${colors.bold}${msg}${colors.reset}`),
};

// State files
const dxLockPath = path.join(projectRoot, ".dx-lock");
const dxStatePath = path.join(projectRoot, ".dx-state.json");

// Configuration
const ports = loadPorts();
const HEALTH_CHECK_TIMEOUT = 60000; // 60 seconds
const HEALTH_CHECK_INTERVAL = 2000; // 2 seconds

/**
 * Run a command and return output
 */
function runCommand(command, options = {}) {
  return execSync(command, {
    cwd: projectRoot,
    stdio: options.silent ? "pipe" : "inherit",
    encoding: "utf8",
    ...options,
  });
}

/**
 * Check if a command exists
 */
function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for HTTP endpoint to be healthy
 */
async function waitForHealth(url, timeout = HEALTH_CHECK_TIMEOUT) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      // Some endpoints (e.g. Supabase REST) return 401/403 when hit without an apikey.
      // For DX readiness we only need the service to be reachable.
      if (response.status >= 200 && response.status < 500) {
        return true;
      } else {
        // Debug log for failure status
        if (Date.now() - startTime > 5000) {
          // Only log after 5s to reduce noise
          console.log(`[debug] Health check ${url} returned status ${response.status}`);
        }
      }
    } catch (error) {
      // Continue waiting
      if (Date.now() - startTime > 5000) {
        console.log(`[debug] Health check ${url} failed: ${error.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  return false;
}

/**
 * Check if Supabase is running
 */
function isSupabaseRunning() {
  try {
    const status = runCommand("npx supabase status", { silent: true });
    return status.includes("API URL") && !status.includes("not running");
  } catch {
    return false;
  }
}

/**
 * Start Supabase
 */
async function startSupabase() {
  log.info("Starting Supabase...");

  if (!commandExists("supabase")) {
    log.error("Supabase CLI not found. Install with: npm install -g supabase");
    process.exit(1);
  }

  if (isSupabaseRunning()) {
    log.success("Supabase already running");
    return;
  }

  try {
    runCommand("supabase start");
    log.success("Supabase started");
  } catch (error) {
    log.warn("Failed to start Supabase - continuing with dx postgres container");
    console.error(error.message);
    // Don't exit - continue with dx postgres for testing
  }

  // Wait for Supabase API to be healthy
  const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);
  // Use 127.0.0.1 to avoid localhost resolution issues
  const supabaseUrl = `http://127.0.0.1:${supabaseApiPort}/rest/v1/`;

  console.log(`[debug] connecting to: ${supabaseUrl}`);
  log.info(`Waiting for Supabase API at ${supabaseUrl}...`);

  // In DevContainer/Codespaces, Docker port forwarding may not work from shell
  // but containers are accessible. Verify container is running instead.
  const isDevContainer =
    process.env.REMOTE_CONTAINERS === "true" ||
    process.env.CODESPACES === "true" ||
    fs.existsSync("/.dockerenv");

  if (isDevContainer) {
    log.info("DevContainer detected - verifying Supabase container status instead of health check");
    try {
      const containerStatus = runCommand(
        'docker ps --filter name=supabase_kong_ValueOS --format "{{.Status}}"',
        { silent: true }
      ).trim();

      if (containerStatus && containerStatus.includes("Up")) {
        log.success("Supabase containers are running (health check skipped in DevContainer)");
      } else {
        log.warn("Supabase Kong container is not running - continuing with dx postgres");
        // Don't exit - continue with dx postgres for testing
      }
    } catch (error) {
      log.warn("Could not verify Supabase container status, continuing anyway");
    }
  } else {
    const healthy = await waitForHealth(supabaseUrl, 30000);
    if (!healthy) {
      log.warn("Supabase API did not become healthy in time - continuing with dx postgres");
      // Don't exit - continue with dx postgres for testing
    } else {
      log.success("Supabase API is healthy");
    }
  }
}

/**
 * Stop Supabase
 */
function stopSupabase() {
  if (!commandExists("supabase")) {
    return;
  }

  if (!isSupabaseRunning()) {
    return;
  }

  log.info("Stopping Supabase...");
  try {
    runCommand("supabase stop", { silent: true });
    log.success("Supabase stopped");
  } catch {
    log.warn("Failed to stop Supabase (may already be stopped)");
  }
}

/**
 * Start Docker dependencies
 */
function startDockerDeps(mode) {
  log.info("Starting Docker dependencies...");

  const composeFile =
    mode === "docker" ? "infra/docker/docker-compose.dev.yml" : "docker-compose.deps.yml";

  try {
    runCommand(`docker compose --env-file .env.ports -f ${composeFile} up -d`, {
      silent: false,
    });
    log.success("Docker dependencies started");
  } catch (error) {
    log.error("Failed to start Docker dependencies");
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Stop Docker dependencies
 */
function stopDockerDeps() {
  log.info("Stopping Docker dependencies...");

  const composeFiles = ["infra/docker/docker-compose.dev.yml", "docker-compose.deps.yml"];

  for (const file of composeFiles) {
    try {
      runCommand(`docker compose --env-file .env.ports -f ${file} down --remove-orphans`, {
        silent: true,
      });
    } catch {
      // Ignore errors
    }
  }

  log.success("Docker dependencies stopped");
}

/**
 * Reset Docker dependencies (remove volumes)
 */
function resetDockerDeps() {
  log.info("Resetting Docker dependencies (removing volumes)...");

  const composeFiles = ["infra/docker/docker-compose.dev.yml", "docker-compose.deps.yml"];

  for (const file of composeFiles) {
    try {
      runCommand(`docker compose --env-file .env.ports -f ${file} down -v --remove-orphans`, {
        silent: true,
      });
    } catch {
      // Ignore errors
    }
  }

  log.success("Docker dependencies reset");
}

/**
 * Run database migrations
 */
async function runMigrations() {
  log.info("Running database migrations...");

  try {
    // Use supabase db push for local development
    runCommand("supabase db push", { silent: false });
    log.success("Migrations applied");
  } catch (error) {
    log.warn("Migration failed (may be OK if already applied)");
    console.error(error.message);
  }
}

/**
 * Verify database schema is correct
 */
async function verifySchema() {
  log.info("Verifying database schema...");

  // Check migration status
  try {
    const migrationList = runCommand("supabase migration list 2>/dev/null || echo ''", {
      silent: true,
    });

    if (migrationList.includes("not applied") || migrationList.includes("pending")) {
      log.warn("Pending migrations detected");
      return false;
    }
  } catch {
    // Migration check not available
  }

  // Regenerate types to ensure they're current
  try {
    runCommand("npm run db:types", { silent: true });
    log.success("Schema verified, types regenerated");
    return true;
  } catch (error) {
    log.warn("Could not regenerate types (non-critical)");
    return true;
  }
}

/**
 * Seed the database
 */
async function seedDatabase() {
  log.info("Seeding database...");

  try {
    runCommand("npm run seed:demo", { silent: false });
    log.success("Database seeded");
  } catch (error) {
    log.warn("Seed failed (may be OK if already seeded)");
  }
}

/**
 * Start backend service
 */
function startBackend() {
  log.info("Starting backend...");

  const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);

  const proc = spawn("npm", ["run", "backend:dev"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    detached: false,
  });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${colors.blue}[backend]${colors.reset} ${line}`);
      }
    });
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${colors.blue}[backend]${colors.reset} ${line}`);
      }
    });
  });

  return proc;
}

/**
 * Start frontend service
 */
function startFrontend() {
  log.info("Starting frontend...");

  const proc = spawn("npm", ["run", "dev"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    detached: false,
  });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${colors.green}[frontend]${colors.reset} ${line}`);
      }
    });
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(`${colors.green}[frontend]${colors.reset} ${line}`);
      }
    });
  });

  return proc;
}

/**
 * Write state files
 */
function writeDxState(mode) {
  const state = {
    pid: process.pid,
    mode,
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(dxStatePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(
    dxLockPath,
    JSON.stringify({ mode, createdAt: new Date().toISOString() }, null, 2)
  );
}

/**
 * Clear state files
 */
function clearDxState() {
  if (fs.existsSync(dxStatePath)) fs.unlinkSync(dxStatePath);
  if (fs.existsSync(dxLockPath)) fs.unlinkSync(dxLockPath);
}

/**
 * Check for existing DX session
 */
function checkExistingSession() {
  if (!fs.existsSync(dxStatePath)) {
    return null;
  }

  try {
    const state = JSON.parse(fs.readFileSync(dxStatePath, "utf8"));
    // Check if process is still running
    try {
      process.kill(state.pid, 0);
      return state;
    } catch {
      // Process not running, clean up
      clearDxState();
      return null;
    }
  } catch {
    clearDxState();
    return null;
  }
}

/**
 * Handle shutdown
 */
function setupShutdownHandler(services) {
  const shutdown = () => {
    console.log("\n\n🛑 Shutting down...\n");

    services.forEach((proc) => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // Ignore
      }
    });

    clearDxState();

    setTimeout(() => {
      log.success("All services stopped");
      process.exit(0);
    }, 2000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", clearDxState);
}

/**
 * Main orchestration
 */
async function main() {
  const args = process.argv.slice(2);

  // Handle --down
  if (args.includes("--down")) {
    stopDockerDeps();
    stopSupabase();
    clearDxState();
    log.success("Development environment stopped");
    return;
  }

  // Handle --reset
  if (args.includes("--reset")) {
    resetDockerDeps();
    stopSupabase();
    clearDxState();
    log.success("Development environment reset");
    return;
  }

  // Resolve mode
  let mode;
  try {
    mode = resolveMode(args);
  } catch (error) {
    log.error(error.message);
    process.exit(1);
  }

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    ValueOS Development                         ║
║                      Mode: ${mode.padEnd(10)}                          ║
╚════════════════════════════════════════════════════════════════╝
`);

  // Check for existing session
  const existingSession = checkExistingSession();
  if (existingSession) {
    log.error(
      `Another DX session is running (pid ${existingSession.pid}, mode ${existingSession.mode})`
    );
    log.info("Stop it first: npm run dx:down");
    process.exit(1);
  }

  // Step 1: Compile environment
  log.step(1, "Compiling environment configuration");
  writeEnvFiles(mode, { force: true });

  // Step 2: Run doctor checks
  log.step(2, "Running preflight checks");
  try {
    runCommand(`node scripts/dx/doctor.js --mode ${mode}`, { silent: false });
  } catch (error) {
    log.error("Preflight checks failed. Fix the issues above and try again.");
    process.exit(1);
  }

  // Step 3: Start Docker dependencies
  log.step(3, "Starting Docker dependencies");
  startDockerDeps(mode);

  // Step 4: Start Supabase (local mode only)
  if (mode === "local") {
    log.step(4, "Starting Supabase");
    await startSupabase();
  } else {
    log.step(4, "Supabase (using Docker service)");
    log.info("Supabase runs as part of Docker Compose in docker mode");
  }

  // Step 5: Run migrations and verify schema
  log.step(5, "Running database migrations");
  await runMigrations();
  await verifySchema();

  // Step 6: Seed database (optional, skip if already seeded)
  if (args.includes("--seed")) {
    log.step(6, "Seeding database");
    await seedDatabase();
  } else {
    log.step(6, "Skipping database seed (use --seed to run)");
  }

  // For docker mode, we're done - Docker Compose handles the services
  if (mode === "docker") {
    writeDxState(mode);

    const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
    const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
    const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    Services Running                            ║
╠════════════════════════════════════════════════════════════════╣
║  Frontend:        http://localhost:${frontendPort}                      ║
║  Backend:         http://localhost:${backendPort}                       ║
║  Supabase API:    http://localhost:${supabaseApiPort}                     ║
║  Supabase Studio: http://localhost:${ports.supabase.studioPort}                     ║
╠════════════════════════════════════════════════════════════════╣
║  Stop:  npm run dx:down                                        ║
║  Logs:  npm run dx:logs                                        ║
╚════════════════════════════════════════════════════════════════╝
`);
    return;
  }

  // Local mode: start backend and frontend
  const services = [];

  // Step 7: Start backend
  log.step(7, "Starting backend");
  const backendProc = startBackend();
  services.push(backendProc);

  // Wait for backend to be healthy
  const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
  const backendHealthUrl = `http://127.0.0.1:${backendPort}/health`;

  log.info(`Waiting for backend at ${backendHealthUrl}...`);
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Initial delay

  const backendHealthy = await waitForHealth(backendHealthUrl, 30000);
  if (!backendHealthy) {
    log.warn("Backend health check timed out (continuing anyway)");
  } else {
    log.success("Backend is healthy");
  }

  // Step 8: Start frontend
  log.step(8, "Starting frontend");
  const frontendProc = startFrontend();
  services.push(frontendProc);

  // Setup shutdown handler
  setupShutdownHandler(services);
  writeDxState(mode);

  // Wait for frontend
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
  const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    All Services Ready                          ║
╠════════════════════════════════════════════════════════════════╣
║  Frontend:        http://localhost:${frontendPort}                      ║
║  Backend:         http://localhost:${backendPort}                       ║
║  Supabase API:    http://localhost:${supabaseApiPort}                     ║
║  Supabase Studio: http://localhost:${ports.supabase.studioPort}                     ║
╠════════════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop all services                             ║
╚════════════════════════════════════════════════════════════════╝
`);

  // Keep process alive
  await new Promise(() => {});
}

main().catch((error) => {
  log.error(`Orchestrator failed: ${error.message}`);
  process.exit(1);
});
