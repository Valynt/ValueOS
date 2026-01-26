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
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { resolveMode } from "./lib/mode.js";
import { loadPorts, resolvePort, writePortsEnvFile } from "./ports.js";
import { writeEnvFiles, validateEnvLocal } from "./env-compiler.js";
import { CheckpointManager } from "./checkpoint-manager.js";
import { TraceLogger } from "./trace-logger.js";
import { formatError } from "./error-codes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Load environment variables from .env.local
config({ path: path.join(projectRoot, ".env.local") });

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
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY = 2000;

// Initialize checkpoint manager and trace logger
const checkpointManager = new CheckpointManager(projectRoot);
const traceLogger = new TraceLogger(projectRoot);

/**
 * Check if running in a DevContainer environment
 */
function checkIsDevContainer() {
  return (
    process.env.REMOTE_CONTAINERS === "true" ||
    process.env.CODESPACES === "true" ||
    fs.existsSync("/.dockerenv")
  );
}

/**
 * Check if Docker is available and running
 */
function checkDockerAvailable() {
  if (!commandExists("docker")) {
    return false;
  }

  try {
    runCommand("docker info", { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run preflight checks to ensure DX can run successfully
 */
function runPreflightChecks() {
  log.info("Running preflight checks...");

  // Check Docker availability (platform-aware)
  if (!checkDockerAvailable()) {
    log.error("Docker is not available or not running");
    if (checkIsDevContainer()) {
      log.error("Fix: Ensure Docker socket is mounted in DevContainer");
    } else {
      log.error("Fix: Start Docker Desktop or install Docker Engine");
    }
    process.exit(1);
  }
  log.success("Docker available");

  // Check DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    log.error("DATABASE_URL environment variable not set");
    log.error("Fix: Run 'pnpm run dx:env' to generate environment files");
    process.exit(1);
  }
  log.success("DATABASE_URL configured");

  // Check Supabase availability if it should be running
  const shouldRunSupabase =
    process.env.DX_FORCE_SUPABASE === "1" ||
    (process.env.DX_SKIP_SUPABASE !== "1" && checkDockerAvailable());

  if (shouldRunSupabase && !isSupabaseRunning()) {
    log.warn("Supabase should be running but is not available");
    log.info("This may be OK if starting for the first time");
  } else if (shouldRunSupabase) {
    log.success("Supabase available");
  } else {
    log.info("Supabase skipped (using dx postgres)");
  }
}

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

async function runWithRetries(label, action, { attempts = RETRY_ATTEMPTS } = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (attempt > 1) {
        const delay = RETRY_BASE_DELAY * 2 ** (attempt - 2);
        log.warn(`${label} retry ${attempt}/${attempts} (waiting ${delay}ms)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return await action(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Check if a local port is already in use
 */
function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onFailure = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(1000);
    socket.once("error", onFailure);
    socket.once("timeout", onFailure);
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
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
    const localPath = path.join(projectRoot, "node_modules", ".bin", cmd);
    return fs.existsSync(localPath);
  }
}

/**
 * Wait for HTTP endpoint to be healthy with deep validation
 */
async function waitForHealth(url, timeout = HEALTH_CHECK_TIMEOUT, validateResponse = null) {
  const startTime = Date.now();
  traceLogger.info(`Health check starting for ${url}`);

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      // Deep validation if provided
      if (validateResponse) {
        try {
          const body = await response.text();
          const isValid = validateResponse(response.status, body);
          if (isValid) {
            traceLogger.info(`Health check passed for ${url}`, { status: response.status });
            return true;
          }
        } catch (validationError) {
          traceLogger.warn(`Health validation failed for ${url}`, { error: validationError.message });
        }
      } else {
        // Default validation: 2xx-4xx status codes
        if (response.status >= 200 && response.status < 500) {
          traceLogger.info(`Health check passed for ${url}`, { status: response.status });
          return true;
        }
      }
      
      if (Date.now() - startTime > 5000) {
        traceLogger.warn(`Health check ${url} returned status ${response.status}`);
      }
    } catch (error) {
      if (Date.now() - startTime > 5000) {
        traceLogger.warn(`Health check ${url} failed`, { error: error.message });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  traceLogger.error(`Health check timed out for ${url}`);
  return false;
}

async function waitForHealthWithRetries(url, { attempts = RETRY_ATTEMPTS, timeout } = {}) {
  return runWithRetries(
    "Health check",
    async () => {
      const healthy = await waitForHealth(url, timeout);
      if (!healthy) {
        throw new Error(`Health check failed for ${url}`);
      }
      return true;
    },
    { attempts }
  ).catch(() => false);
}

/**
 * Check if Supabase is running
 */
function isSupabaseRunning() {
  try {
    const status = runCommand("pnpm supabase status --workdir infra/supabase", { silent: true });
    return status.includes("API URL") && !status.includes("not running");
  } catch {
    return false;
  }
}

/**
 * Get the Supabase database URL from status output
 */
function getSupabaseDbUrl() {
  try {
    const status = runCommand("pnpm supabase status --workdir infra/supabase", { silent: true });
    const dbUrlMatch = status.match(/DB URL:\s*(postgresql:\/\/[^\s]+)/);
    if (dbUrlMatch) {
      // Append sslmode=disable for local development
      return `${dbUrlMatch[1]}?sslmode=disable`;
    }
  } catch {
    // Fall back to nothing
  }
  return null;
}

/**
 * Start Supabase (idempotent - checks if already running)
 */
async function startSupabase() {
  const stepStart = traceLogger.stepStart("start_supabase");
  log.info("Starting Supabase...");

  // Check if already running (idempotent)
  if (isSupabaseRunning()) {
    log.success("Supabase already running (idempotent check)");
    traceLogger.stepSuccess("start_supabase", stepStart, { alreadyRunning: true });
    return;
  }

  // Check explicit override flags first
  if (process.env.DX_FORCE_SUPABASE === "1") {
    log.info("DX_FORCE_SUPABASE=1 detected - forcing Supabase startup");
  } else if (process.env.DX_SKIP_SUPABASE === "1") {
    log.warn("DX_SKIP_SUPABASE=1 detected - skipping Supabase");
    log.info("Using valueos-postgres container on port 5432 for development");
    return;
  } else if (!checkDockerAvailable()) {
    log.warn("Docker not available - skipping Supabase");
    log.info("Using valueos-postgres container on port 5432 for development");
    return;
  }

  let useDlx = false;
  if (!commandExists("supabase")) {
    log.warn("Supabase CLI not found locally. Will attempt to run via 'pnpm dlx supabase' fallback.");
    try {
      // Check if pnpm dlx can fetch the supabase CLI
      runCommand("pnpm dlx supabase --version", { silent: true });
      useDlx = true;
      log.info("pnpm dlx supabase is available as a fallback");
    } catch (err) {
      log.warn("Could not run 'pnpm dlx supabase' - Supabase CLI not available");
      // Do not exit here: continue and allow dx to fall back to dx postgres
    }
  }

  try {
    const supabaseStartCmd = useDlx ? "pnpm dlx supabase start --workdir infra/supabase" : "supabase start --workdir infra/supabase";
    traceLogger.info("Running Supabase start command", { command: supabaseStartCmd });
    runCommand(supabaseStartCmd);
    log.success("Supabase started");
    traceLogger.stepSuccess("start_supabase", stepStart);
  } catch (error) {
    traceLogger.stepError("start_supabase", error);
    log.warn(formatError("ERR_010", { command: useDlx ? "pnpm dlx supabase" : "supabase", error: error.message }));
    console.error(error.message);
    // Don't exit - continue with dx postgres for testing
  }

  // Wait for Supabase API to be healthy
  const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);
  // Use 127.0.0.1 to avoid localhost resolution issues
  const supabaseUrl = `http://127.0.0.1:${supabaseApiPort}/rest/v1/`;

  console.log(`[debug] connecting to: ${supabaseUrl}`);
  log.info(`Waiting for Supabase API at ${supabaseUrl}...`);

  // In containerized environments, port forwarding may not work reliably from shell
  // but containers are accessible. Verify container is running instead.
  const isContainerized = checkIsDevContainer() || process.env.CONTAINER === "true";

  if (isContainerized) {
    log.info(
      "Container environment detected - verifying Supabase container status instead of health check"
    );
    try {
      const containerStatus = runCommand(
        'docker ps --filter name=supabase_kong_ValueOS --format "{{.Status}}"',
        { silent: true }
      ).trim();

      if (containerStatus && containerStatus.includes("Up")) {
        log.success(
          "Supabase containers are running (health check skipped in container environment)"
        );
      } else {
        log.warn("Supabase Kong container is not running - continuing with dx postgres");
        // Don't exit - continue with dx postgres for testing
      }
    } catch (error) {
      log.warn("Could not verify Supabase container status, continuing anyway");
    }
  } else {
    const healthy = await waitForHealthWithRetries(supabaseUrl, {
      attempts: RETRY_ATTEMPTS,
      timeout: 30000,
    });
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
    runCommand("supabase stop --workdir infra/supabase", { silent: true });
    log.success("Supabase stopped");
  } catch {
    log.warn("Failed to stop Supabase (may already be stopped)");
  }
}

/**
 * Start Docker dependencies
 */
async function startDockerDeps(mode) {
  const stepStart = traceLogger.stepStart("start_docker_deps", { mode });
  const checkpoint = checkpointManager.save("docker_deps", { mode });
  
  log.info("Starting Docker dependencies...");

  const composeFile =
    mode === "docker" ? "infra/docker/docker-compose.dev.yml" : "docker-compose.deps.yml";

  // In full docker mode, we want images current and builds reproducible.
  // For deps-only mode, do not force builds.
  const upFlags = mode === "docker" ? " --build --pull=missing" : "";

  try {
    await runWithRetries("Docker pull", async () => {
      runCommand(
        `docker compose --env-file .env.ports -f ${composeFile} pull --ignore-pull-failures`,
        { silent: false }
      );
    });

    if (mode === "docker") {
      await runWithRetries("Docker build", async () => {
        try {
          runCommand(`docker compose --env-file .env.ports -f ${composeFile} build --pull`, {
            silent: false,
          });
        } catch (error) {
          const message = String(error?.message || "");
          if (
            message.includes("ERR_PNPM") ||
            message.includes("pnpm") ||
            message.includes("store")
          ) {
            log.warn(
              "Detected possible pnpm store/build cache corruption. Pruning Docker build cache before retry."
            );
            runCommand("docker builder prune -af", { silent: false });
          }
          throw error;
        }
      });
    }

    await runWithRetries("Docker up", async () => {
      runCommand(`docker compose --env-file .env.ports -f ${composeFile} up -d${upFlags}`, {
        silent: false,
      });
    });

    log.success("Docker dependencies started");
    checkpointManager.commit(checkpoint);
    traceLogger.stepSuccess("start_docker_deps", stepStart);
  } catch (error) {
    traceLogger.stepError("start_docker_deps", error);
    log.error(formatError("ERR_008", { composeFile, error: error.message }));
    console.error(String(error?.message || error));
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
function resetDockerDeps(level = "soft") {
  log.info(`Resetting Docker dependencies (${level})...`);

  const composeFiles = ["infra/docker/docker-compose.dev.yml", "docker-compose.deps.yml"];

  for (const file of composeFiles) {
    try {
      const downArgs = level === "soft" ? "down -v --remove-orphans" : "down -v --remove-orphans";
      runCommand(`docker compose --env-file .env.ports -f ${file} ${downArgs}`, {
        silent: true,
      });
    } catch {
      // Ignore errors
    }
  }

  if (level === "hard") {
    try {
      runCommand("docker builder prune -af", { silent: false });
    } catch {
      log.warn("Failed to prune Docker build cache (continuing).");
    }
  }

  log.success("Docker dependencies reset");
}

/**
 * Run database migrations
 */
async function runMigrations() {
  log.info("Running database migrations...");

  const stepStart = traceLogger.stepStart("run_migrations");
  const checkpoint = checkpointManager.save("migrations");
  
  try {
    // Determine command based on Supabase availability
    let command = "supabase db push --workdir infra/supabase";
    const supabaseDbUrl = getSupabaseDbUrl();

    if (supabaseDbUrl) {
      // Supabase is running, use its actual DB URL
      command = `supabase db push --workdir infra/supabase --db-url "${supabaseDbUrl}"`;
      log.info("Pushing migrations to Supabase-managed Postgres...");
    } else {
      // Fall back to dx postgres container
      let host = process.env.POSTGRES_HOST || "localhost";
      
      // In DevContainer environments, localhost doesn't work - use container IP
      if (checkIsDevContainer()) {
        try {
          const containerInfo = runCommand("docker inspect valueos-postgres", { silent: true });
          const networks = JSON.parse(containerInfo)[0].NetworkSettings.Networks;
          const networkName = Object.keys(networks)[0];
          host = networks[networkName].IPAddress;
          log.info(`Using container IP ${host} for DevContainer environment`);
        } catch (error) {
          log.warn("Could not get container IP, falling back to localhost");
        }
      }
      
      const dbUrl = `postgresql://postgres:dev_password@${host}:5432/valuecanvas_dev?sslmode=disable`;
      command = `supabase db push --workdir infra/supabase --db-url "${dbUrl}"`;
      log.info(`Pushing migrations to dx postgres container (${host})...`);
    traceLogger.info("Running migration command", { command });
    runCommand(command, { silent: false });
    log.success("Migrations applied");
    checkpointManager.commit(checkpoint);
    traceLogger.stepSuccess("run_migrations", stepStart
    // Use supabase db push for local development
    runCommand(command, { silent: false });
    traceLogger.stepError("run_migrations", error);
    const errorMessage = error.message || "";
    const lowered = errorMessage.toLowerCase();

    // Distinguish error types with diagnostic codes
    if (lowered.includes("already applied") || lowered.includes("up to date")) {
      log.success("Migrations already applied (safe)");
      checkpointManager.commit(checkpoint);
      return { ok: true };
    } else if (lowered.includes("tls error") || lowered.includes("refused tls")) {
      log.error(formatError("ERR_006", { dbUrl: "check connection string", error: errorMessage }));
      console.error(errorMessage);
      return { ok: false, error: errorMessage, fatal: true };
    } else if (
      lowered.includes("connection refused") ||
      lowered.includes("no such host") ||
      lowered.includes("connection failed")
    ) {
      log.error(formatError("ERR_004", { error: errorMessage })
      lowered.includes("connection failed")
    ) {
      log.error("Migration failed due to connection error (fatal)");
      console.error(errorMessage);
      return { ok: false, error: errorMessage, fatal: true };
    } else if (
      lowered.includes("syntax error") ||
      lowered.includes("relation") ||
      lowered.includes("does not exist")
    ) {
      log.error("Migration failed due to schema error (fatal)");
      console.error(errorMessage);
      return { ok: false, error: errorMessage, fatal: true };
    } else {
      log.warn("Migration failed (unknown error - may be safe if already applied)");
      console.error(errorMessage);
      return { ok: false, error: errorMessage };
    }
  }
}

function shouldAutoInitDb(message = "") {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("does not exist") ||
    lowered.includes("relation") ||
    lowered.includes("schema") ||
    lowered.includes("not initialized") ||
    lowered.includes("connection refused")
  );
}

async function autoInitializeDb() {
  log.info("Attempting to auto-initialize database...");
  try {
    runCommand("supabase db reset --workdir infra/supabase", { silent: false });
    log.success("Database reset completed");
    return true;
  } catch (error) {
    log.warn("Database reset failed");
    console.error(error.message);
    return false;
  }
}

/**
 * Verify database schema is correct
 */
async function verifySchema() {
  log.info("Verifying database schema...");

  // Check migration status
  try {
    const migrationList = runCommand("supabase migration list --workdir infra/supabase 2>/dev/null || echo ''", {
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
    runCommand("pnpm run db:types", { silent: true });
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
    runCommand("pnpm run seed:demo", { silent: false });
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

  const proc = spawn("pnpm", ["run", "backend:dev"], {
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

  const proc = spawn("pnpm", ["run", "dev"], {
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
    traceLogger.info("Shutdown initiated");

    services.forEach((proc) => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // Ignore
      }
    });

    clearDxState();
    checkpointManager.clear();
    traceLogger.close();

    setTimeout(() => {
      log.success("All services stopped");
      process.exit(0);
    }, 2000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", () => {
    clearDxState();
    traceLogger.close();
  }
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

  // Run preflight checks
  runPreflightChecks();

  // Handle --down
  if (args.includes("--down")) {
    stopDockerDeps();
    stopSupabase();
    clearDxState();
    log.success("Development environment stopped");
    return;
  }

  // Handle --reset
  const resetIndex = args.indexOf("--reset");
  if (resetIndex !== -1) {
    const level = args[resetIndex + 1] === "hard" ? "hard" : "soft";
    resetDockerDeps(level);
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
    log.info("Stop it first: pnpm run dx:down");
    process.exit(1);
  }

  // Step 1: Compile environment
  log.step(1, "Compiling environment configuration");
  writeEnvFiles(mode, { force: true });

  // Step 2: Run doctor checks
  log.step(2, "Running preflight checks");
  try {
    runCommand(`node scripts/dx/doctor.js --mode ${mode} --soft`, { silent: false });
  } catch (error) {
    log.error("Preflight checks failed. Fix the issues above and try again.");
    process.exit(1);
  }

  // Step 3: Start Docker dependencies
  log.step(3, "Starting Docker dependencies");
  await startDockerDeps(mode);

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
  let dbInitAttempted = false;
  let migrationsResult = await runMigrations();

  if (!migrationsResult.ok) {
    // Check if this is a fatal error that shouldn't be auto-recovered
    if (migrationsResult.fatal) {
      log.error("Fatal migration error - cannot continue");
      process.exit(1);
    }

    if (shouldAutoInitDb(migrationsResult.error) && !dbInitAttempted) {
      dbInitAttempted = true;
      const initOk = await autoInitializeDb();
      if (initOk) {
        migrationsResult = await runMigrations();
        if (migrationsResult.ok) {
          log.success("Migrations succeeded after auto-initialization");
          if (!args.includes("--seed")) {
            log.info("Auto-seeding database after initialization");
            await seedDatabase();
          }
        }
      }
    }
  }
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
║  Stop:  pnpm run dx:down                                        ║
║  Logs:  pnpm run dx:logs                                        ║
╚════════════════════════════════════════════════════════════════╝
`);
    return;
  }

  // Local mode: start backend and frontend
  const services = [];

  // Step 7: Start backend
  log.step(7, "Starting backend");
  const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
  const backendPortInUse = await isPortInUse(backendPort);

  let backendProc = null;
  if (backendPortInUse) { with deep validation
  const backendHealthUrl = `http://127.0.0.1:${backendPort}/health`;

  log.info(`Waiting for backend at ${backendHealthUrl}...`);
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Initial delay

  const backendHealthy = await waitForHealthWithRetries(backendHealthUrl, {
    attempts: RETRY_ATTEMPTS,
    timeout: 30000,
  });
  if (!backendHealthy) {
    log.error(formatError("ERR_003", { healthUrl: backendHealthUrl })); = `http://127.0.0.1:${backendPort}/health`;

  log.info(`Waiting for backend at ${backendHealthUrl}...`);
  await new Promise((resolve) => setTimeout(resolve, 3000)); // Initial delay

  const backendHealthy = await waitForHealthWithRetries(backendHealthUrl, {
    attempts: RETRY_ATTEMPTS,
    timeout: 30000,
  });
  if (!backendHealthy) {
    log.warn("Backend health check timed out (continuing anyway)");
  } else {
    log.success("Backend is healthy");
  }

  // Step 8: Start frontend
  log.step(8, "Starting frontend");
  const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
  const frontendPortInUse = await isPortInUse(frontendPort);

  let frontendProc = null;
  if (frontendPortInUse) {
    log.warn(
      `Frontend port ${frontendPort} is already in use. Skipping frontend start to avoid duplicates.`
    );
  } else {
    frontendProc = startFrontend();
    services.push(frontendProc);
  }

  // Setup shutdown handler
  setupShutdownHandler(services);
  writeDxState(mode);

  // Wait for frontend
  await new Promise((resolve) => setTimeout(resolve, 5000));

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
