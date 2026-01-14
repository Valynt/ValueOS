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
      "Run: npm run env:dev"
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
        "Update .env.local with real anon key: npm run env:dev"
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
    if (!value || value.includes("localhost") === false) {
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
        'docker compose --env-file .env.ports -f infra/docker/docker-compose.yml ps --filter "status=running" --services',
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
      "Stop it with: npm run dx:down (or use npm run dx:docker)"
    );
  }

  if (mode === "docker" && depsRunning.length > 0) {
    reportFailure(
      "Local deps already running",
      `Running services: ${depsRunning.join(", ")}`,
      "Stop it with: npm run dx:down (or use npm run dx)"
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
    "Run: npm run dx:reset"
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
      "Install with: npm install -g supabase (or set DX_SUPABASE_LOCAL=0 to skip)"
    );
    return;
  }

  try {
    runCommand("supabase status");
  } catch {
    reportFailure(
      "Supabase local not running",
      `Expected Supabase at http://localhost:${supabaseApiPort}`,
      "Start it with: supabase start"
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
      'docker compose --env-file .env.ports -f infra/docker/docker-compose.yml ps postgres --filter "status=running"',
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
          "Run: supabase db push (or npm run db:push)"
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

  ensurePortsEnvFile();
  checkNodeVersion();
  checkDocker();
  checkEnvironment();
  checkComposeState();
  checkDockerContainerHealth();
  checkSupabase();
  checkMigrationDrift();
  await checkDevEdgeRouting();
  await checkPorts();

  if (failures.length > 0) {
    console.log("❌ Preflight checks failed:\n");
    failures.forEach((failure) => {
      console.log(`- ${failure.title}`);
      console.log(`  ${failure.details}`);
      if (failure.fix) {
        console.log(`  Fix: ${failure.fix}`);
      }
      console.log("");
    });
    process.exit(1);
  }

  console.log("✅ All preflight checks passed.\n");
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
