#!/usr/bin/env node

/**
 * DX Doctor: fail-fast preflight checks for dev environment.
 */

import fs from "fs";
import https from "https";
import net from "net";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { resolveMode } from "./lib/mode.js";
import {
  loadPorts,
  resolvePort,
  formatPortsEnv,
  writePortsEnvFile,
} from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
let mode;
try {
  mode = resolveMode(args);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Soft mode: print warnings but don't block dev server startup
const softMode =
  args.includes("--soft") ||
  args.includes("-s") ||
  process.env.DX_SOFT_DOCTOR === "1";

// Incremental check cache
const checkCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const forceCheck = args.includes("--force") || args.includes("-f");

function isCheckCached(checkName) {
  if (forceCheck) return false;

  const cached = checkCache.get(checkName);
  if (!cached) return false;

  const now = Date.now();
  return now - cached.timestamp < CACHE_TTL && cached.passed;
}

function cacheCheckResult(checkName, passed) {
  checkCache.set(checkName, {
    timestamp: Date.now(),
    passed,
  });
}

function runCheckWithCache(checkName, checkFunction) {
  if (isCheckCached(checkName)) {
    console.log(`⏭️  ${checkName} (cached)`);
    return;
  }

  console.log(`🔍 ${checkName}`);
  const startTime = Date.now();

  try {
    checkFunction();
    const duration = Date.now() - startTime;
    console.log(`✅ ${checkName} (${duration}ms)`);
    cacheCheckResult(checkName, true);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${checkName} (${duration}ms)`);
    cacheCheckResult(checkName, false);
    throw error;
  }
}

const ports = loadPorts();
const frontendPort = resolvePort(process.env.VITE_PORT, ports.frontend.port);
const backendPort = resolvePort(process.env.API_PORT, ports.backend.port);
const postgresPort = resolvePort(
  process.env.POSTGRES_PORT,
  ports.postgres.port
);
const redisPort = resolvePort(process.env.REDIS_PORT, ports.redis.port);
const supabaseApiPort = resolvePort(
  process.env.SUPABASE_API_PORT,
  ports.supabase.apiPort
);
const supabaseStudioPort = resolvePort(
  process.env.SUPABASE_STUDIO_PORT,
  ports.supabase.studioPort
);
const caddyHttpsPort = resolvePort(
  process.env.CADDY_HTTPS_PORT,
  ports.edge.httpsPort
);

const frontendUrl =
  process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;

const failures = [];

function reportFailure(title, details, fix) {
  failures.push({ title, details, fix });
}

function runCommand(command, options = {}) {
  return execSync(command, {
    cwd: projectRoot,
    stdio: "pipe",
    encoding: "utf8",
    ...options,
  });
}

function commandExists(command) {
  try {
    execSync(`command -v ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensurePortsEnvFile() {
  const portsPath = path.join(projectRoot, ".env.ports");
  const desired = formatPortsEnv(ports);

  if (!fs.existsSync(portsPath)) {
    writePortsEnvFile(portsPath);
    return;
  }

  const current = fs.readFileSync(portsPath, "utf8");
  if (current.trim() !== desired.trim()) {
    writePortsEnvFile(portsPath);
  }
}

function parseMajor(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

function checkNodeVersion() {
  const nvmrcPath = path.join(projectRoot, ".nvmrc");
  if (!fs.existsSync(nvmrcPath)) {
    return;
  }

  const expected = fs.readFileSync(nvmrcPath, "utf8").trim();
  if (!expected) {
    return;
  }

  const expectedMajor = parseMajor(expected);
  const actualMajor = parseMajor(process.version);

  if (expectedMajor && actualMajor !== expectedMajor) {
    reportFailure(
      "Node.js version mismatch",
      `Expected Node ${expectedMajor} from .nvmrc, found ${process.version}.`,
      "Run: nvm install && nvm use"
    );
  }
}

function checkDocker() {
  if (!commandExists("docker")) {
    reportFailure(
      "Docker missing",
      "Docker CLI not found in PATH.",
      "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
    );
    return;
  }

  let dockerContext = "unknown";
  let contextError = null;
  let contextDetails = "";

  try {
    dockerContext = runCommand("docker context show").trim();
  } catch (error) {
    contextError = error;
  }

  try {
    const contextList = runCommand(
      'docker context ls --format "{{.Name}}: {{.DockerEndpoint}}"'
    ).trim();
    contextDetails = contextList.split("\n").slice(0, 3).join("; ");
  } catch {
    // Ignore context list errors
  }

  try {
    runCommand("docker info");
  } catch (error) {
    const errorMsg = error.message || "";
    let fix = "Start Docker Desktop (or `sudo systemctl start docker`).";
    let details = `Docker daemon is not responding. Current context: ${dockerContext}.`;

    if (errorMsg.includes("permission denied")) {
      fix =
        "Add your user to the docker group: sudo usermod -aG docker $USER && newgrp docker";
      details = `Docker permission denied. Current context: ${dockerContext}.`;
    } else if (
      errorMsg.includes("Cannot connect") ||
      errorMsg.includes("connection refused")
    ) {
      details = `Cannot connect to Docker daemon. Context: ${dockerContext}. Available: ${contextDetails || "unknown"}.`;
      fix =
        dockerContext !== "default"
          ? `Try: docker context use default (current: ${dockerContext})`
          : "Start Docker Desktop (or `sudo systemctl start docker`).";
    }

    reportFailure("Docker not running", details, fix);
  }

  if (contextError) {
    reportFailure(
      "Docker context unavailable",
      `Unable to read Docker context. This may indicate a Docker configuration issue.`,
      "Run: docker context use default"
    );
  }
}

function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once("listening", () => {
        tester.close(() => resolve(false));
      })
      .listen(port, host);
  });
}

function isDockerPortPublished(port) {
  try {
    const output = runCommand('docker ps --format "{{.Ports}}"').trim();
    if (!output) {
      return false;
    }

    const matcher = new RegExp(`(^|,\\s*)(?:[^\\s,]+:)?${port}->`);
    return output.split("\n").some((line) => matcher.test(line));
  } catch {
    return false;
  }
}

async function checkPorts() {
  const portChecks = [
    { name: "Frontend", port: frontendPort },
    { name: "Backend", port: backendPort },
  ];

  if (mode === "local") {
    portChecks.push(
      { name: "Postgres", port: postgresPort },
      { name: "Redis", port: redisPort }
    );
  }

  for (const { name, port } of portChecks) {
    const inUse = await isPortInUse(port);
    if (
      inUse &&
      !isDockerPortPublished(port) &&
      process.env.DX_ALLOW_PORT_IN_USE !== "1"
    ) {
      reportFailure(
        `${name} port in use`,
        `Port ${port} is already bound on localhost.`,
        `Free the port (lsof -i :${port}) or run with DX_ALLOW_PORT_IN_USE=1.`
      );
    }
  }
}

function checkEnvironment() {
  const envLocalPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envLocalPath)) {
    reportFailure(
      ".env.local missing",
      "Local environment file is required.",
      "Run: pnpm run env:dev"
    );
    return;
  }

  // Check for placeholder Supabase keys
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  const lines = envContent.split("\n");

  const supabaseAnonKeyLine = lines.find((line) =>
    line.startsWith("VITE_SUPABASE_ANON_KEY=")
  );
  const supabaseUrlLine = lines.find((line) =>
    line.startsWith("VITE_SUPABASE_URL=")
  );

  if (supabaseAnonKeyLine) {
    const value = supabaseAnonKeyLine.split("=")[1];
    if (
      !value ||
      value.includes("placeholder") ||
      value.includes("your-") ||
      value.length < 100
    ) {
      reportFailure(
        "Invalid Supabase anon key",
        "VITE_SUPABASE_ANON_KEY is missing, blank, or using placeholder value.",
        "Update .env.local with real anon key: pnpm run env:dev"
      );
    }
  } else {
    reportFailure(
      "Missing Supabase anon key",
      "VITE_SUPABASE_ANON_KEY not found in .env.local",
      "Add to .env.local: VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    );
  }

  if (supabaseUrlLine) {
    const value = supabaseUrlLine.split("=")[1];
    const isLocalUrl =
      value && (value.includes("localhost") || value.includes("127.0.0.1"));
    if (!isLocalUrl) {
      reportFailure(
        "Invalid Supabase URL",
        "VITE_SUPABASE_URL should point to local Supabase instance.",
        "Set VITE_SUPABASE_URL=http://localhost:54321 in .env.local"
      );
    }
  }

  // Check .env.ports for container environment
  const envPortsPath = path.join(projectRoot, "deploy/envs/.env.ports");
  if (fs.existsSync(envPortsPath)) {
    const portsContent = fs.readFileSync(envPortsPath, "utf8");
    const portsLines = portsContent.split("\n");

    const portsAnonKeyLine = portsLines.find((line) =>
      line.startsWith("VITE_SUPABASE_ANON_KEY=")
    );
    if (!portsAnonKeyLine || portsAnonKeyLine.includes("placeholder")) {
      reportFailure(
        "Container Supabase key missing",
        "deploy/envs/.env.ports missing real VITE_SUPABASE_ANON_KEY for containers.",
        "Update deploy/envs/.env.ports with real anon key"
      );
    }
  }
}

function checkComposeState() {
  let fullRunning = [];
  let depsRunning = [];

  if (commandExists("docker")) {
    try {
      fullRunning = runCommand(
        'docker compose --env-file .env.ports -f infra/docker/docker-compose.dev.yml ps --filter "status=running" --services',
        {
          stdio: "pipe",
        }
      )
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      fullRunning = [];
    }

    try {
      depsRunning = runCommand(
        'docker compose --env-file .env.ports -f docker-compose.deps.yml ps --filter "status=running" --services',
        {
          stdio: "pipe",
        }
      )
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      depsRunning = [];
    }
  }

  if (mode === "local" && fullRunning.length > 0) {
    reportFailure(
      "Full Docker stack already running",
      `Running services: ${fullRunning.join(", ")}`,
      "Stop it with: pnpm run dx:down (or use pnpm run dx:docker)"
    );
  }

  if (mode === "docker" && depsRunning.length > 0) {
    reportFailure(
      "Local deps already running",
      `Running services: ${depsRunning.join(", ")}`,
      "Stop it with: pnpm run dx:down (or use pnpm run dx)"
    );
  }
}

function checkDockerContainerHealth() {
  if (!commandExists("docker")) {
    return;
  }

  let containers = [];
  try {
    containers = runCommand('docker ps -a --format "{{.ID}}\t{{.Names}}"')
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, name] = line.split("\t");
        return { id, name };
      });
  } catch {
    return;
  }

  if (containers.length === 0) {
    return;
  }

  const unhealthy = [];
  const restartLoops = [];

  containers.forEach(({ id, name }) => {
    try {
      const statusLine = runCommand(
        `docker inspect --format "{{.State.Status}}\t{{.State.RestartCount}}\t{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" ${id}`
      )
        .trim()
        .split("\t");

      const [status, restartCountRaw, healthStatus] = statusLine;
      const restartCount = Number(restartCountRaw);
      const isRestarting = status === "restarting";
      if (healthStatus === "unhealthy") {
        unhealthy.push(name);
      }
      if (isRestarting || restartCount > 1) {
        const detail = `${name} (restarts: ${Number.isNaN(restartCount) ? "unknown" : restartCount}${isRestarting ? ", restarting" : ""})`;
        restartLoops.push(detail);
      }
    } catch {
      // Ignore containers that cannot be inspected.
    }
  });

  if (unhealthy.length === 0 && restartLoops.length === 0) {
    return;
  }

  const detailParts = [];
  if (unhealthy.length > 0) {
    detailParts.push(`Unhealthy containers: ${unhealthy.join(", ")}.`);
  }
  if (restartLoops.length > 0) {
    detailParts.push(`Repeated restarts detected: ${restartLoops.join(", ")}.`);
  }

  reportFailure(
    "Docker containers unhealthy or restarting",
    detailParts.join(" "),
    "Run: pnpm run dx:reset"
  );
}

function checkSupabase() {
  const viteSupabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const localFlag = process.env.DX_SUPABASE_LOCAL;

  // Explicit opt-out
  if (localFlag === "0" || localFlag === "false") {
    return;
  }

  const isLocalSupabase =
    localFlag === "1" ||
    localFlag === "true" ||
    viteSupabaseUrl.includes("localhost") ||
    viteSupabaseUrl.includes("127.0.0.1");
  if (!isLocalSupabase) {
    return;
  }

  if (!commandExists("supabase")) {
    reportFailure(
      "Supabase CLI missing",
      "Supabase URL is local but CLI is not installed.",
      "Install with: pnpm install -g supabase (or set DX_SUPABASE_LOCAL=0 to skip)"
    );
    return;
  }

  // Check if Supabase is running
  let supabaseRunning = false;
  let supabaseStatus = "";
  try {
    supabaseStatus = runCommand("supabase status", { stdio: "pipe" });
    supabaseRunning =
      supabaseStatus.includes("API URL") &&
      !supabaseStatus.includes("not running");
  } catch {
    supabaseRunning = false;
  }

  if (!supabaseRunning) {
    reportFailure(
      "Supabase local not running",
      `Expected Supabase at http://localhost:${supabaseApiPort}`,
      "Start it with: supabase start (or pnpm run dx will start it automatically)"
    );
    return;
  }

  // Check Supabase API health
  const healthUrl = `http://localhost:${supabaseApiPort}/rest/v1/`;
  try {
    runCommand(`curl -sf --max-time 5 "${healthUrl}" > /dev/null`, {
      stdio: "pipe",
    });
  } catch {
    reportFailure(
      "Supabase API not responding",
      `Supabase is running but API at ${healthUrl} is not responding.`,
      "Try: supabase stop && supabase start"
    );
    return;
  }

  // Verify env URLs point to local Supabase
  const backendSupabaseUrl = process.env.SUPABASE_URL || "";
  if (
    backendSupabaseUrl &&
    !backendSupabaseUrl.includes("localhost") &&
    !backendSupabaseUrl.includes("127.0.0.1")
  ) {
    reportFailure(
      "Backend Supabase URL mismatch",
      `SUPABASE_URL points to ${backendSupabaseUrl} but local Supabase is running.`,
      "Set SUPABASE_URL=http://localhost:54321 in .env.local"
    );
  }
}

function checkSupabaseMigrations() {
  const viteSupabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const localFlag = process.env.DX_SUPABASE_LOCAL;

  // Skip if not using local Supabase
  if (localFlag === "0" || localFlag === "false") {
    return;
  }

  const isLocalSupabase =
    localFlag === "1" ||
    localFlag === "true" ||
    viteSupabaseUrl.includes("localhost") ||
    viteSupabaseUrl.includes("127.0.0.1");

  if (!isLocalSupabase || !commandExists("supabase")) {
    return;
  }

  // Check migration status
  try {
    const migrationList = runCommand(
      "supabase migration list 2>/dev/null || echo 'unavailable'",
      { stdio: "pipe" }
    );

    if (migrationList.includes("unavailable")) {
      return; // Can't check migrations
    }

    // Count pending migrations
    const lines = migrationList.split("\n").filter((line) => line.trim());
    const pendingMigrations = lines.filter(
      (line) =>
        line.includes("not applied") ||
        line.includes("pending") ||
        (line.includes("│") && !line.includes("applied"))
    );

    if (pendingMigrations.length > 0) {
      reportFailure(
        "Pending database migrations",
        `${pendingMigrations.length} migration(s) not applied to local database.`,
        "Run: pnpm run db:push (or supabase db push)"
      );
    }
  } catch {
    // Migration check failed, skip
  }
}

function checkSupabaseSchema() {
  const viteSupabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const localFlag = process.env.DX_SUPABASE_LOCAL;

  // Skip if not using local Supabase or in docker mode
  if (localFlag === "0" || localFlag === "false" || mode === "docker") {
    return;
  }

  const isLocalSupabase =
    localFlag === "1" ||
    localFlag === "true" ||
    viteSupabaseUrl.includes("localhost") ||
    viteSupabaseUrl.includes("127.0.0.1");

  if (!isLocalSupabase || !commandExists("supabase")) {
    return;
  }

  // Check for schema drift using supabase db diff
  try {
    const diff = runCommand(
      "supabase db diff --use-migra 2>/dev/null || echo ''",
      { stdio: "pipe" }
    );

    // If diff output contains CREATE/ALTER/DROP statements, there's drift
    const hasDrift =
      diff.trim().length > 0 &&
      (diff.includes("CREATE") ||
        diff.includes("ALTER") ||
        diff.includes("DROP"));

    if (hasDrift) {
      const lineCount = diff.split("\n").filter((l) => l.trim()).length;
      reportFailure(
        "Database schema drift detected",
        `Local database differs from migrations (${lineCount} changes).`,
        "Run: pnpm run db:reset to rebuild from migrations, or pnpm run db:push to apply pending changes"
      );
    }
  } catch {
    // Schema diff not available or failed, skip
  }

  // Check that generated types are up to date
  const typesPath = path.join(projectRoot, "src/types/supabase.ts");
  const migrationsDir = path.join(projectRoot, "supabase/migrations");

  if (fs.existsSync(typesPath) && fs.existsSync(migrationsDir)) {
    try {
      const typesStat = fs.statSync(typesPath);
      const migrations = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"));

      // Check if any migration is newer than types file
      const newerMigrations = migrations.filter((m) => {
        const migrationPath = path.join(migrationsDir, m);
        const migrationStat = fs.statSync(migrationPath);
        return migrationStat.mtime > typesStat.mtime;
      });

      if (newerMigrations.length > 0) {
        reportFailure(
          "Supabase types may be outdated",
          `${newerMigrations.length} migration(s) newer than generated types.`,
          "Run: pnpm run db:types to regenerate TypeScript types"
        );
      }
    } catch {
      // File stat failed, skip
    }
  }
}

function checkEnvModeConsistency() {
  const envLocalPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envLocalPath)) {
    return;
  }

  const content = fs.readFileSync(envLocalPath, "utf8");

  // Check DX_MODE matches current mode
  const modeMatch = content.match(/^DX_MODE=(.*)$/m);
  const envMode = modeMatch ? modeMatch[1].trim() : null;

  if (envMode && envMode !== mode) {
    reportFailure(
      "Environment mode mismatch",
      `.env.local is configured for mode "${envMode}" but you're running mode "${mode}".`,
      `Regenerate env: pnpm run dx:env --mode ${mode} --force`
    );
    return;
  }

  // Check for Docker DNS in local mode
  if (mode === "local") {
    const apiUrlMatch = content.match(/^VITE_API_BASE_URL=(.*)$/m);
    if (apiUrlMatch) {
      const apiUrl = apiUrlMatch[1].trim();
      if (apiUrl.includes("backend:") || apiUrl.includes("frontend:")) {
        reportFailure(
          "Docker DNS in local mode",
          `VITE_API_BASE_URL uses Docker hostname (${apiUrl}) but mode is "local". Browser cannot resolve Docker hostnames.`,
          `Regenerate env: pnpm run dx:env --mode local --force`
        );
      }
    }
  }

  // Check for deprecated SUPABASE_SERVICE_KEY
  if (
    content.includes("SUPABASE_SERVICE_KEY=") &&
    !content.includes("SUPABASE_SERVICE_ROLE_KEY=")
  ) {
    reportFailure(
      "Deprecated Supabase key name",
      "Using SUPABASE_SERVICE_KEY instead of SUPABASE_SERVICE_ROLE_KEY.",
      "Update .env.local: rename SUPABASE_SERVICE_KEY to SUPABASE_SERVICE_ROLE_KEY"
    );
  }
}

function checkMigrationDrift() {
  if (mode !== "local") {
    return;
  }

  // Only check if postgres container is running
  try {
    runCommand(
      'docker compose --env-file .env.ports -f docker-compose.deps.yml ps postgres --filter "status=running"',
      { stdio: "pipe" }
    );
  } catch {
    return; // Postgres not running, skip migration check
  }

  // Check if supabase migrations directory exists
  const migrationsDir = path.join(projectRoot, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  // Count local migration files
  let localMigrations = [];
  try {
    localMigrations = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"));
  } catch {
    return;
  }

  if (localMigrations.length === 0) {
    return;
  }

  // Try to check applied migrations via supabase CLI if available
  if (commandExists("supabase")) {
    try {
      const status = runCommand(
        'supabase migration list --local 2>/dev/null || echo "unavailable"'
      );
      if (status.includes("unavailable")) {
        return;
      }

      // Count pending migrations (lines with "not applied" or similar)
      const pendingCount = (status.match(/pending|not applied/gi) || []).length;
      if (pendingCount > 0) {
        reportFailure(
          "Database migrations pending",
          `${pendingCount} migration(s) not applied to local database.`,
          "Run: supabase db push (or pnpm run db:push)"
        );
      }
    } catch {
      // Supabase CLI check failed, skip
    }
  }
}

function checkHttpsEndpoint(url) {
  return new Promise((resolve) => {
    const request = https.get(
      url,
      { rejectUnauthorized: false, timeout: 3000 },
      (response) => {
        const { statusCode } = response;
        response.resume();
        resolve({
          ok:
            Number.isInteger(statusCode) &&
            statusCode >= 200 &&
            statusCode < 400,
          statusCode,
        });
      }
    );

    request.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });
  });
}

async function checkDevEdgeRouting() {
  if (!commandExists("docker")) {
    return;
  }

  const composeFile = path.join(
    projectRoot,
    "infra",
    "docker",
    "docker-compose.dev-caddy.yml"
  );
  let runningServices = [];

  try {
    runningServices = runCommand(
      `docker compose -f ${composeFile} ps --filter "status=running" --services`,
      { stdio: "pipe" }
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return;
  }

  if (!runningServices.includes("caddy")) {
    return;
  }

  const endpoints = [
    `https://localhost:${caddyHttpsPort}/healthz`,
    `https://localhost:${caddyHttpsPort}/api/health`,
  ];
  const restartCommand = `docker compose -f ${composeFile} restart`;
  const restartFix = `${restartCommand} (or: docker compose -f ${composeFile} down && docker compose -f ${composeFile} up -d)`;

  for (const endpoint of endpoints) {
    const result = await checkHttpsEndpoint(endpoint);
    if (!result.ok) {
      const statusDetail = result.statusCode
        ? `status ${result.statusCode}`
        : result.error || "unknown error";
      reportFailure(
        "Dev edge routing error",
        `Failed to reach ${endpoint} (${statusDetail}).`,
        `Restart the dev edge stack: ${restartFix}`
      );
    }
  }
}

async function main() {
  if (!["local", "docker"].includes(mode)) {
    console.error(
      `❌ Invalid mode "${mode}". Use --mode local or --mode docker.`
    );
    process.exit(1);
  }

  console.log(`\n🧪 DX Doctor (mode: ${mode})\n`);

  // Phase 1: Setup (must run first)
  ensurePortsEnvFile();

  // Phase 2: Independent environment checks (run in parallel)
  await Promise.all([
    Promise.resolve().then(() => {
      if (!isCheckCached("Node Version")) {
        checkNodeVersion();
        cacheCheckResult("Node Version", failures.length === 0);
      } else {
        console.log(`⏭️  Node Version check (cached)`);
      }
    }),
    Promise.resolve().then(() => {
      if (!isCheckCached("Environment")) {
        checkEnvironment();
        cacheCheckResult("Environment", failures.length === 0);
      } else {
        console.log(`⏭️  Environment check (cached)`);
      }
    }),
    Promise.resolve().then(() => {
      if (!isCheckCached("Env Mode Consistency")) {
        checkEnvModeConsistency();
        cacheCheckResult("Env Mode Consistency", failures.length === 0);
      } else {
        console.log(`⏭️  Env Mode Consistency check (cached)`);
      }
    }),
  ]);

  // Phase 3: Docker-dependent checks (run sequentially after environment checks)
  if (!isCheckCached("Docker")) {
    checkDocker();
    cacheCheckResult("Docker", failures.length === 0);
  } else {
    console.log(`⏭️  Docker check (cached)`);
  }

  if (!isCheckCached("Compose State")) {
    checkComposeState();
    cacheCheckResult("Compose State", failures.length === 0);
  } else {
    console.log(`⏭️  Compose State check (cached)`);
  }

  if (!isCheckCached("Container Health")) {
    checkDockerContainerHealth();
    cacheCheckResult("Container Health", failures.length === 0);
  } else {
    console.log(`⏭️  Container Health check (cached)`);
  }

  // Phase 4: Service checks (run in parallel)
  await Promise.all([
    Promise.resolve().then(() => {
      if (!isCheckCached("Supabase")) {
        checkSupabase();
        cacheCheckResult("Supabase", failures.length === 0);
      } else {
        console.log(`⏭️  Supabase check (cached)`);
      }
    }),
    Promise.resolve().then(() => {
      if (!isCheckCached("Migration Drift")) {
        checkMigrationDrift();
        cacheCheckResult("Migration Drift", failures.length === 0);
      } else {
        console.log(`⏭️  Migration Drift check (cached)`);
      }
    }),
  ]);

  // Phase 4b: Supabase schema checks (after Supabase is confirmed running)
  await Promise.all([
    Promise.resolve().then(() => {
      if (!isCheckCached("Supabase Migrations")) {
        checkSupabaseMigrations();
        cacheCheckResult("Supabase Migrations", failures.length === 0);
      } else {
        console.log(`⏭️  Supabase Migrations check (cached)`);
      }
    }),
    Promise.resolve().then(() => {
      if (!isCheckCached("Supabase Schema")) {
        checkSupabaseSchema();
        cacheCheckResult("Supabase Schema", failures.length === 0);
      } else {
        console.log(`⏭️  Supabase Schema check (cached)`);
      }
    }),
  ]);

  // Phase 5: Network/async checks (run in parallel)
  await Promise.all([
    Promise.resolve().then(async () => {
      if (!isCheckCached("Dev Edge Routing")) {
        await checkDevEdgeRouting();
        cacheCheckResult("Dev Edge Routing", failures.length === 0);
      } else {
        console.log(`⏭️  Dev Edge Routing check (cached)`);
      }
    }),
    Promise.resolve().then(async () => {
      if (!isCheckCached("Ports")) {
        await checkPorts();
        cacheCheckResult("Ports", failures.length === 0);
      } else {
        console.log(`⏭️  Ports check (cached)`);
      }
    }),
  ]);

  if (failures.length > 0) {
    if (softMode) {
      console.log(
        "\n⚠️  Preflight checks have warnings (soft mode - continuing):\n"
      );
    } else {
      console.log("\n❌ Preflight checks failed:\n");
    }

    // Classify failures as blocking vs non-blocking
    const blockingFailures = failures.filter(
      (f) =>
        (f.title.includes("Docker") && f.title.includes("not running")) ||
        f.title.includes("Node.js version") ||
        f.title.includes(".env.local missing")
    );
    const warningFailures = failures.filter(
      (f) => !blockingFailures.includes(f)
    );

    if (blockingFailures.length > 0) {
      console.log("🚫 Blocking issues (must fix):");
      blockingFailures.forEach((failure) => {
        console.log(`  - ${failure.title}`);
        console.log(`    ${failure.details}`);
        if (failure.fix) {
          console.log(`    Fix: ${failure.fix}`);
        }
        console.log("");
      });
    }

    if (warningFailures.length > 0) {
      console.log("⚠️  Warnings (can continue in degraded mode):");
      warningFailures.forEach((failure) => {
        console.log(`  - ${failure.title}`);
        console.log(`    ${failure.details}`);
        if (failure.fix) {
          console.log(`    Fix: ${failure.fix}`);
        }
        console.log("");
      });
    }

    // In soft mode, only exit if there are blocking failures
    if (softMode) {
      if (blockingFailures.length > 0) {
        console.log("\n❌ Cannot continue due to blocking issues above.\n");
        process.exit(1);
      }
      console.log(
        "\n⚠️  Continuing with warnings. Some features may not work.\n"
      );
    } else {
      process.exit(1);
    }
  } else {
    console.log("\n✅ All preflight checks passed.\n");
  }
  console.log("Ports:");
  console.log(`  Frontend:        ${frontendUrl}`);
  console.log(`  Backend:         ${backendUrl}`);
  console.log(`  Supabase API:    http://localhost:${supabaseApiPort}`);
  console.log(`  Supabase Studio: http://localhost:${supabaseStudioPort}\n`);
}

main().catch((error) => {
  console.error("❌ Doctor failed:", error.message);
  process.exit(1);
});
