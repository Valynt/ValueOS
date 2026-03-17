#!/usr/bin/env node

/**
 * DX Doctor: fail-fast preflight checks for dev environment.
 * Workstation-only checks. Not for use in Docker builds.
 */

import fs from "fs";
import https from "https";
import net from "net";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { resolveMode } from "./lib/mode.js";
import { loadPorts, resolvePort, formatPortsEnv, writePortsEnvFile } from "./ports.js";
import { resolveSupabaseMode, extractUrlHost, isLocalHost } from "./lib/supabase-mode.js";
import { isDevContainer, resolveDockerHostGateway } from "./lib/runtime.js";
import { composeCommand, parseComposeProfiles } from "./lib/compose.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const opsEnvDir = path.join(projectRoot, "ops", "env");
const opsEnvLocalPath = path.join(opsEnvDir, ".env.local");
const opsEnvPortsPath = path.join(opsEnvDir, ".env.ports");

config({ path: opsEnvLocalPath });

const args = process.argv.slice(2);
const composeProfiles = parseComposeProfiles(args);
let mode;
try {
  mode = resolveMode(args);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const dockerHostGateway = resolveDockerHostGateway();
const localHosts = dockerHostGateway ? [dockerHostGateway] : [];
const networkHosts = ["supabase"];
const supabaseMode = resolveSupabaseMode({ env: process.env, localHosts, networkHosts });

// Soft mode: print warnings but don't block dev server startup
const softMode =
  args.includes("--soft") || args.includes("-s") || process.env.DX_SOFT_DOCTOR === "1";
const autoShiftPorts =
  args.includes("--auto-shift-ports") || process.env.DX_AUTO_SHIFT_PORTS === "1";
const allowEnvPlaceholders = process.env.DX_DOCTOR_ALLOW_PLACEHOLDERS === "1";
const allowMixedLockfiles = process.env.DX_ALLOW_MIXED_LOCKFILES === "1";

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
const postgresPort = resolvePort(process.env.POSTGRES_PORT, ports.postgres.port);
const redisPort = resolvePort(process.env.REDIS_PORT, ports.redis.port);
const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, ports.supabase.apiPort);
const supabaseStudioPort = resolvePort(process.env.SUPABASE_STUDIO_PORT, ports.supabase.studioPort);
const caddyHttpsPort = resolvePort(process.env.CADDY_HTTPS_PORT, ports.edge.httpsPort);

const frontendUrl = process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
const pnpmVersion = "9.15.0";

const failures = [];
const unhealthyContainers = new Set();
const restartingContainers = new Set();

function reportFailure(title, details, fix) {
  failures.push({ title, details, fix });
}

function classifySupabaseEndpoint(rawUrl) {
  const host = extractUrlHost(rawUrl);
  if (!host) return "unknown";
  if (isLocalHost(host, localHosts)) return "host";
  if (isLocalHost(host, [], networkHosts)) return "network";
  return "remote";
}

function checkSupabaseNetworkingConsistency() {
  const frontendUrl = process.env.VITE_SUPABASE_URL || "";
  const backendUrl = process.env.SUPABASE_URL || "";

  if (!frontendUrl || !backendUrl) {
    return;
  }

  const frontendKind = classifySupabaseEndpoint(frontendUrl);
  const backendKind = classifySupabaseEndpoint(backendUrl);

  if (mode === "docker") {
    if (frontendKind !== "host" || backendKind !== "network") {
      reportFailure(
        "Mixed Supabase networking in docker mode",
        `Docker mode expects browser URL on host and backend URL on Compose network. Got VITE_SUPABASE_URL=${frontendUrl} (${frontendKind}), SUPABASE_URL=${backendUrl} (${backendKind}).`,
        "Run: pnpm run dx:env --mode docker --force so frontend uses localhost and backend uses http://supabase:<port>."
      );
    }
    return;
  }

  if (mode === "local") {
    if (frontendKind !== "host" || backendKind !== "host") {
      reportFailure(
        "Mixed Supabase networking in local mode",
        `Local mode expects host endpoints for both frontend and backend. Got VITE_SUPABASE_URL=${frontendUrl} (${frontendKind}), SUPABASE_URL=${backendUrl} (${backendKind}).`,
        "Run: pnpm run dx:env --mode local --force so both URLs point to localhost (or configured host gateway)."
      );
    }
  }
}

function runCommand(command, options = {}) {
  try {
    return execSync(command, {
      cwd: projectRoot,
      stdio: "pipe",
      encoding: "utf8",
      ...options,
    });
  } catch (error) {
    // In some containerized/sandboxed environments execSync throws with EPERM
    // even when the subprocess returns status 0. Treat that as success to
    // avoid false "missing tool" reports.
    if (error?.status === 0) {
      const out = (error.stdout || "").toString();
      return out;
    }
    throw error;
  }
}

function commandExists(command) {
  try {
    // Try Unix-style command first
    execSync(`command -v ${command}`, { stdio: "ignore" });
    return true;
  } catch (error) {
    if (error?.status === 0) return true;
    try {
      // Try Windows-style where command
      execSync(`where ${command}`, { stdio: "ignore" });
      return true;
    } catch (winError) {
      if (winError?.status === 0) return true;
      // Check local node_modules/.bin
      const localPath = path.join(projectRoot, "node_modules", ".bin", command);
      return fs.existsSync(localPath);
    }
  }
}

function ensurePortsEnvFile() {
  if (!fs.existsSync(opsEnvPortsPath)) {
    reportFailure(
      ".env.ports missing",
      "ops/env/.env.ports is required for DX tooling.",
      `Run: pnpm run dx:env --mode ${mode} --force`
    );
    return false;
  }

  const desired = formatPortsEnv(ports);
  const current = fs.readFileSync(opsEnvPortsPath, "utf8");
  if (current.trim() !== desired.trim()) {
    writePortsEnvFile(opsEnvPortsPath);
  }

  return true;
}

function parseMajor(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

function parseEnvFile(envPath) {
  const data = fs.readFileSync(envPath, "utf8");
  const vars = {};
  data.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...rest] = trimmed.split("=");
    if (!key) return;
    vars[key.trim()] = rest.join("=").trim();
  });
  return vars;
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

function checkPnpmVersion() {
  if (!commandExists("corepack")) {
    reportFailure(
      "Corepack missing",
      "corepack is not available (required for pnpm activation).",
      "Install Node >= 16.13 or enable Corepack."
    );
    return;
  }

  try {
    runCommand("corepack enable");
    runCommand(`corepack prepare pnpm@${pnpmVersion} --activate`);
  } catch (error) {
    reportFailure(
      "Corepack activation failed",
      "Unable to activate pinned pnpm via Corepack.",
      "Run: corepack enable && corepack prepare pnpm@9.15.0 --activate"
    );
    return;
  }

  try {
    const actual = runCommand("pnpm -v").trim();
    if (actual !== pnpmVersion) {
      reportFailure(
        "pnpm version mismatch",
        `Expected pnpm ${pnpmVersion}, found ${actual}.`,
        `Run: corepack prepare pnpm@${pnpmVersion} --activate`
      );
    }
  } catch {
    reportFailure(
      "pnpm missing",
      "pnpm is not available after Corepack activation.",
      "Run: corepack prepare pnpm@9.15.0 --activate"
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
      if (isDevContainer()) {
        fix =
          "Ensure /var/run/docker.sock is mounted and accessible (devcontainer.json mounts + docker-outside-of-docker feature). Rebuild the container if needed.";
      } else {
        fix = "Add your user to the docker group: sudo usermod -aG docker $USER && newgrp docker";
      }
      details = `Docker permission denied. Current context: ${dockerContext}.`;
    } else if (errorMsg.includes("Cannot connect") || errorMsg.includes("connection refused")) {
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

  try {
    const composeVersion = runCommand("docker compose version --short").trim();
    // Parse version to handle both v2.x.x and 2.x.x formats
    const versionParts = composeVersion.replace(/^v/, "").split(".");
    const majorVersion = parseInt(versionParts[0], 10);

    if (majorVersion < 2) {
      reportFailure(
        "Docker Compose v2 required",
        `Detected version: "${composeVersion}" (parsed major: ${majorVersion}) via command: docker compose version --short`,
        "Upgrade Docker Desktop/Engine to use Compose v2."
      );
    }
  } catch {
    reportFailure(
      "Docker Compose missing",
      "Command failed: docker compose version --short. docker compose (v2) is not available.",
      "Install Docker Desktop or Docker Engine with Compose v2."
    );
  }

  try {
    // Check if BuildKit is enabled via environment variable or buildx plugin
    const buildkitEnabled =
      process.env.DOCKER_BUILDKIT === "1" || process.env.DOCKER_BUILDKIT?.toLowerCase() === "true";

    // If not enabled via env var, check if buildx plugin is available
    let hasBuildxPlugin = false;
    if (!buildkitEnabled) {
      try {
        const info = runCommand("docker info --format '{{json .}}'");
        const parsed = JSON.parse(info);
        hasBuildxPlugin = parsed?.ClientInfo?.Plugins?.some((plugin) => plugin.Name === "buildx");
      } catch {
        // Ignore JSON parsing failures
      }
    }

    if (!buildkitEnabled && !hasBuildxPlugin) {
      const envValue = process.env.DOCKER_BUILDKIT || "not set";
      reportFailure(
        "Docker BuildKit disabled",
        `BuildKit not enabled. Environment variable: DOCKER_BUILDKIT="${envValue}". Detection command: docker info --format '{{json .}}' (checked for buildx plugin)`,
        "Enable BuildKit: export DOCKER_BUILDKIT=1 (or enable in Docker Desktop settings)."
      );
    }
  } catch {
    // Ignore BuildKit detection failures
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

async function findNextAvailablePort(startPort) {
  for (let port = startPort + 1; port < startPort + 50; port += 1) {
    if (!(await isPortInUse(port))) {
      return port;
    }
  }
  return null;
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
    { name: "Frontend", port: frontendPort, env: "VITE_PORT" },
    {
      name: "Vite HMR",
      port: resolvePort(process.env.VITE_HMR_PORT, ports.frontend.hmrPort),
      env: "VITE_HMR_PORT",
    },
    { name: "Backend", port: backendPort, env: "API_PORT" },
    { name: "Supabase API", port: supabaseApiPort, env: "SUPABASE_API_PORT" },
    { name: "Supabase Studio", port: supabaseStudioPort, env: "SUPABASE_STUDIO_PORT" },
    {
      name: "Supabase DB",
      port: resolvePort(process.env.SUPABASE_DB_PORT, ports.supabase.dbPort),
      env: "SUPABASE_DB_PORT",
    },
    {
      name: "Caddy HTTP",
      port: resolvePort(process.env.CADDY_HTTP_PORT, ports.edge.httpPort),
      env: "CADDY_HTTP_PORT",
    },
    {
      name: "Caddy HTTPS",
      port: resolvePort(process.env.CADDY_HTTPS_PORT, ports.edge.httpsPort),
      env: "CADDY_HTTPS_PORT",
    },
    {
      name: "Caddy Admin",
      port: resolvePort(process.env.CADDY_ADMIN_PORT, ports.edge.adminPort),
      env: "CADDY_ADMIN_PORT",
    },
    {
      name: "Prometheus",
      port: resolvePort(process.env.PROMETHEUS_PORT, ports.observability.prometheusPort),
      env: "PROMETHEUS_PORT",
    },
    {
      name: "Grafana",
      port: resolvePort(process.env.GRAFANA_PORT, ports.observability.grafanaPort),
      env: "GRAFANA_PORT",
    },
  ];

  if (mode === "local") {
    portChecks.push(
      { name: "Postgres", port: postgresPort, env: "POSTGRES_PORT" },
      { name: "Redis", port: redisPort, env: "REDIS_PORT" }
    );
  }

  const overrides = {};

  for (const { name, port, env } of portChecks) {
    const inUse = await isPortInUse(port);
    if (inUse && !isDockerPortPublished(port) && process.env.DX_ALLOW_PORT_IN_USE !== "1") {
      if (autoShiftPorts) {
        const suggestion = await findNextAvailablePort(port);
        if (!suggestion) {
          reportFailure(
            `${name} port in use`,
            `Port ${port} is already bound and no alternative port found.`,
            `Free the port (lsof -i :${port}) or set ${name.toUpperCase()}_PORT.`
          );
        } else {
          overrides[env] = suggestion;
          console.log(`⚠️  Auto-shifted ${name} port from ${port} to ${suggestion}.`);
        }
      } else {
        reportFailure(
          `${name} port in use`,
          `Port ${port} is already bound on localhost.`,
          `Free the port (lsof -i :${port}) or run with DX_ALLOW_PORT_IN_USE=1.`
        );
      }
    }
  }

  if (autoShiftPorts && Object.keys(overrides).length > 0) {
    writePortsEnvFile(opsEnvPortsPath, overrides);
    console.log("✅ Updated ops/env/.env.ports with auto-shifted ports.");
  }
}

function checkEnvironment() {
  if (!fs.existsSync(opsEnvLocalPath)) {
    reportFailure(
      ".env.local missing",
      "Local environment file is required.",
      `Run: pnpm run dx:env --mode ${mode} --force`
    );
    return;
  }

  const envVars = parseEnvFile(opsEnvLocalPath);
  const envContent = fs.readFileSync(opsEnvLocalPath, "utf8");
  const lines = envContent.split("\n");

  const supabaseAnonKeyLine = lines.find((line) => line.startsWith("VITE_SUPABASE_ANON_KEY="));
  const supabaseUrlLine = lines.find((line) => line.startsWith("VITE_SUPABASE_URL="));

  if (supabaseAnonKeyLine) {
    const value = supabaseAnonKeyLine.split("=")[1];
    if (
      !value ||
      value.includes("placeholder") ||
      value.includes("your-") ||
      (!allowEnvPlaceholders && value.length < 100)
    ) {
      reportFailure(
        "Invalid Supabase anon key",
        "VITE_SUPABASE_ANON_KEY is missing, blank, or using placeholder value.",
        "Update ops/env/.env.local with real anon key: pnpm run dx:env --mode local --force"
      );
    }
  } else {
    reportFailure(
      "Missing Supabase anon key",
      "VITE_SUPABASE_ANON_KEY not found in ops/env/.env.local",
      "Add to ops/env/.env.local: VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    );
  }

  if (supabaseUrlLine) {
    const value = supabaseUrlLine.split("=")[1];
    const host = extractUrlHost(value);
    if (!isLocalHost(host, localHosts, networkHosts)) {
      reportFailure(
        "Invalid Supabase URL",
        "VITE_SUPABASE_URL should point to a local or in-network Supabase instance.",
        "Set VITE_SUPABASE_URL to localhost for local mode (or regenerate with pnpm run dx:env --mode local --force)."
      );
    }
  }

  const requiredKeys = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "REDIS_URL",
  ];

  const placeholderPatterns = ["replace-with", "your-", "changeme", "placeholder"];
  requiredKeys.forEach((key) => {
    const value = envVars[key];
    if (!value || value.trim() === "") {
      reportFailure(
        `Missing ${key}`,
        `${key} is required and currently empty.`,
        "Run: pnpm run dx:env --mode local --force"
      );
      return;
    }

    if (
      !allowEnvPlaceholders &&
      placeholderPatterns.some((pattern) => value.toLowerCase().includes(pattern))
    ) {
      reportFailure(
        `Placeholder ${key}`,
        `${key} still contains a placeholder value.`,
        "Update ops/env/.env.local with a real value."
      );
    }
  });

  // Container env files load ops/env/.env.local directly; no additional .env.ports checks required.
}

function checkMixedLockfiles() {
  const packageLock = path.join(projectRoot, "package-lock.json");
  const yarnLock = path.join(projectRoot, "yarn.lock");
  const pnpmLock = path.join(projectRoot, "pnpm-lock.yaml");

  const present = [
    fs.existsSync(packageLock) ? "package-lock.json" : null,
    fs.existsSync(yarnLock) ? "yarn.lock" : null,
    fs.existsSync(pnpmLock) ? "pnpm-lock.yaml" : null,
  ].filter(Boolean);

  if (present.length > 1 && !allowMixedLockfiles) {
    reportFailure(
      "Mixed package managers",
      `Multiple lockfiles detected: ${present.join(", ")}.`,
      "Remove non-pnpm lockfiles (or set DX_ALLOW_MIXED_LOCKFILES=1 if intentional)."
    );
  }
}

function checkDiskSpace() {
  try {
    const output = runCommand("df -Pk .");
    const lines = output.split("\n").filter(Boolean);
    if (lines.length < 2) return;
    const parts = lines[1].split(/\s+/);
    const availableKb = Number(parts[3]);
    const availableGb = availableKb / 1024 / 1024;
    const thresholdGb = Number(process.env.DX_MIN_DISK_GB || 10);

    if (availableGb < thresholdGb) {
      reportFailure(
        "Low disk space",
        `Only ${availableGb.toFixed(1)}GB free (threshold ${thresholdGb}GB).`,
        "Free up disk space to avoid Docker build failures."
      );
    }
  } catch {
    // Ignore disk check failures
  }
}

function checkWslSettings() {
  try {
    const versionInfo = fs.readFileSync("/proc/version", "utf8");
    const isWsl = versionInfo.toLowerCase().includes("microsoft");
    if (!isWsl) return;

    if (projectRoot.startsWith("/mnt/")) {
      reportFailure(
        "WSL filesystem performance",
        "Repository is on /mnt (Windows filesystem), which slows file watching.",
        "Move repo into the WSL Linux filesystem (e.g. ~/src/valueos)."
      );
    }

    const inotifyPath = "/proc/sys/fs/inotify/max_user_watches";
    if (fs.existsSync(inotifyPath)) {
      const value = Number(fs.readFileSync(inotifyPath, "utf8").trim());
      if (Number.isInteger(value) && value < 524288) {
        reportFailure(
          "WSL inotify limits",
          `max_user_watches is ${value} (recommended >= 524288).`,
          "Update /etc/sysctl.conf and reload sysctl to raise inotify limits."
        );
      }
    }
  } catch {
    // Ignore WSL checks if unavailable
  }
}

function checkComposeState() {
  let dockerRunning = [];
  let localRunning = [];

  if (commandExists("docker")) {
    try {
      const { command } = composeCommand("ps", {
        mode: "docker",
        profiles: composeProfiles,
        extraArgs: ["--filter", "status=running", "--services"],
      });
      dockerRunning = runCommand(command, { stdio: "pipe" }).trim().split("\n").filter(Boolean);
    } catch {
      dockerRunning = [];
    }

    try {
      const { command } = composeCommand("ps", {
        mode: "local",
        profiles: composeProfiles,
        extraArgs: ["--filter", "status=running", "--services"],
      });
      localRunning = runCommand(command, { stdio: "pipe" }).trim().split("\n").filter(Boolean);
    } catch {
      localRunning = [];
    }
  }

  if (mode === "local" && dockerRunning.length > 0) {
    reportFailure(
      "Full Docker stack already running",
      `Running services: ${dockerRunning.join(", ")}`,
      "Stop it with: pnpm run dx:down (or use pnpm run dx:docker)"
    );
  }

  if (mode === "docker" && localRunning.length > 0) {
    reportFailure(
      "Local deps already running",
      `Running services: ${localRunning.join(", ")}`,
      "Stop it with: pnpm run dx:down (or use pnpm run dx)"
    );
  }
}
function checkEnvModeConsistency() {
  if (!fs.existsSync(opsEnvLocalPath)) {
    return;
  }

  const content = fs.readFileSync(opsEnvLocalPath, "utf8");

  // Check DX_MODE matches current mode
  const modeMatch = content.match(/^DX_MODE=(.*)$/m);
  const envMode = modeMatch ? modeMatch[1].trim() : null;

  if (envMode && envMode !== mode) {
    reportFailure(
      "Environment mode mismatch",
      `ops/env/.env.local is configured for mode "${envMode}" but you're running mode "${mode}".`,
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
      "Update ops/env/.env.local: rename SUPABASE_SERVICE_KEY to SUPABASE_SERVICE_ROLE_KEY"
    );
  }
}

function checkMigrationDrift() {
  if (mode !== "local") {
    return;
  }

  // Only check if postgres container is running
  try {
    const { command } = composeCommand("ps", {
      mode: "local",
      profiles: composeProfiles,
      extraArgs: ["postgres", "--filter", "status=running"],
    });
    runCommand(command, { stdio: "pipe" });
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
    localMigrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
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
    const request = https.get(url, { rejectUnauthorized: false, timeout: 3000 }, (response) => {
      const { statusCode } = response;
      response.resume();
      resolve({
        ok: Number.isInteger(statusCode) && statusCode >= 200 && statusCode < 400,
        statusCode,
      });
    });

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

  const composeFile = path.join(projectRoot, "infra", "docker", "docker-compose.dev-caddy.yml");
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


function printToolVersions() {
  const nodeVersion = process.version;
  let pnpmVersion = "unknown";
  try {
    pnpmVersion = execSync("pnpm --version", { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    // pnpm not on PATH — non-fatal
  }
  console.log(`  Node.js: ${nodeVersion}`);
  console.log(`  pnpm:    ${pnpmVersion === "unknown" ? "not found" : `v${pnpmVersion}`}`);
}

async function main() {
  if (!["local", "docker"].includes(mode)) {
    console.error(`❌ Invalid mode "${mode}". Use --mode local or --mode docker.`);
    process.exit(1);
  }

  console.log(`\n🩺 DX Doctor (mode: ${mode})`);
  printToolVersions();

  // Phase 1: Setup (must run first)
  ensurePortsEnvFile();

  console.log("\nPorts Configuration:");
  console.log(`  Frontend:        ${frontendUrl}`);
  console.log(`  Backend:         ${backendUrl}`);
  console.log(`  Supabase API:    http://localhost:${supabaseApiPort}`);
  console.log(`  Supabase Studio: http://localhost:${supabaseStudioPort}`);
  console.log("");

  if (supabaseMode?.mode) {
    const detail = supabaseMode.host
      ? ` (${supabaseMode.reason}: ${supabaseMode.host})`
      : ` (${supabaseMode.reason})`;
    console.log(`Supabase Mode:   ${supabaseMode.mode}${detail}`);
    console.log("");
  }

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
      if (!isCheckCached("pnpm Version")) {
        checkPnpmVersion();
        cacheCheckResult("pnpm Version", failures.length === 0);
      } else {
        console.log(`⏭️  pnpm Version check (cached)`);
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
      if (!isCheckCached("Mixed Lockfiles")) {
        checkMixedLockfiles();
        cacheCheckResult("Mixed Lockfiles", failures.length === 0);
      } else {
        console.log(`⏭️  Mixed Lockfiles check (cached)`);
      }
    }),
    Promise.resolve().then(() => {
      if (!isCheckCached("Disk Space")) {
        checkDiskSpace();
        cacheCheckResult("Disk Space", failures.length === 0);
      } else {
        console.log(`⏭️  Disk Space check (cached)`);
      }
    }),
    Promise.resolve().then(() => {
      if (!isCheckCached("WSL Settings")) {
        checkWslSettings();
        cacheCheckResult("WSL Settings", failures.length === 0);
      } else {
        console.log(`⏭️  WSL Settings check (cached)`);
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
    Promise.resolve().then(() => {
      if (!isCheckCached("Supabase Networking")) {
        checkSupabaseNetworkingConsistency();
        cacheCheckResult("Supabase Networking", failures.length === 0);
      } else {
        console.log(`⏭️  Supabase Networking check (cached)`);
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
    const header =
      softMode || failures.every((f) => true) ? "\n⚠️  Preflight checks have warnings:\n" : "\n❌ Preflight checks failed:\n";
    console.log(header);

    // Classify failures as blocking vs non-blocking
    const blockingFailures = failures.filter(
      (f) =>
        (f.title.includes("Docker") && f.title.includes("not running")) ||
        f.title.includes("Node.js version") ||
        f.title.includes(".env.ports missing")
    );
    const warningFailures = failures.filter((f) => !blockingFailures.includes(f));

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

    printFailureLogs();

    // Exit code policy: only block on blocking failures; warnings are non-fatal.
    if (blockingFailures.length > 0) {
      console.log("\n❌ Cannot continue due to blocking issues above.\n");
      process.exit(1);
    }

    console.log("\n⚠️  Continuing with warnings. Some features may not work.\n");
  } else {
    console.log("\n✅ All preflight checks passed.\n");
  }

  console.log("Next steps:");
  console.log(`  Start dev stack: ./dev up --mode ${mode}`);
  console.log("  Tail logs:       ./dev logs <service>");
  console.log("  Reset stack:     ./dev reset\n");
}

main().catch((error) => {
  console.error("❌ Doctor failed:", error.message);
  process.exit(1);
});
