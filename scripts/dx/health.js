#!/usr/bin/env node

/**
 * Health Check System
 * Validates all services and dependencies are working.
 *
 * Single source of truth for ports comes from ./ports.js (loadPorts/resolvePort).
 */

import http from "http";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveMode } from "./lib/mode.js";
import { loadPorts, resolvePort } from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mode;
try {
  mode = resolveMode(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Port registry (single source of truth)
const portConfig = loadPorts();

const backendPort = resolvePort(process.env.API_PORT, portConfig.backend.port);
const frontendPort = resolvePort(process.env.VITE_PORT, portConfig.frontend.port);
const postgresPort = resolvePort(process.env.POSTGRES_PORT, portConfig.postgres.port);
const redisPort = resolvePort(process.env.REDIS_PORT, portConfig.redis.port);
const supabaseApiPort = resolvePort(process.env.SUPABASE_API_PORT, portConfig.supabase.apiPort);
const supabaseStudioPort = resolvePort(
  process.env.SUPABASE_STUDIO_PORT,
  portConfig.supabase.studioPort
);

const backendBaseUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
const frontendBaseUrl = process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
const appComposeFile =
  process.env.DX_MODE === "docker" ? "docker-compose.full.yml" : "docker-compose.deps.yml";

const backendContainerCandidates = [
  process.env.BACKEND_CONTAINER_NAME,
  "valueos-backend-dev",
  "valueos-backend",
].filter(Boolean);

const frontendContainerCandidates = [
  process.env.FRONTEND_CONTAINER_NAME,
  "valueos-frontend-dev",
  "valueos-frontend",
].filter(Boolean);

/**
 * Check if a URL is accessible
 */
async function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: `${urlObj.pathname}${urlObj.search}`,
      method: "GET",
      timeout,
    };

    const req = http.request(options, (res) => {
      resolve({ success: true, status: res.statusCode });
    });

    req.on("error", (error) => {
      resolve({ success: false, error: error.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, error: "Timeout" });
    });

    req.end();
  });
}

function normalizeHealthStatus(status) {
  if (!status || status === "<no value>") {
    return "unknown";
  }

  return status;
}

function getContainerHealth(containerNames) {
  for (const containerName of containerNames) {
    try {
      const status = execSync(
        `docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
        { encoding: "utf8" }
      ).trim();

      return { name: containerName, status: normalizeHealthStatus(status) };
    } catch {
      continue;
    }
  }

  return { name: null, status: null };
}

function isHealthMismatch(httpPassed, containerHealth) {
  if (!containerHealth.name) {
    return false;
  }

  const status = containerHealth.status;
  if (!["healthy", "unhealthy", "starting"].includes(status)) {
    return false;
  }

  return (status === "healthy") !== httpPassed;
}

function buildMismatchFix({ name, status, serviceCommand }) {
  return `\
Mismatch between HTTP readiness and container health.
Container: ${name} (${status})

Recovery:
- Inspect health details: docker inspect --format='{{json .State.Health}}' ${name}
- Check container logs: docker logs ${name}
- Restart the service: docker compose -f ${appComposeFile} restart ${serviceCommand}
`;
}

/**
 * Check backend API
 */
async function checkBackend() {
  const healthUrl = `${backendBaseUrl}/health`;
  const result = await checkUrl(healthUrl);
  const containerHealth = getContainerHealth(backendContainerCandidates);
  const httpPassed = result.success && result.status === 200;

  if (isHealthMismatch(httpPassed, containerHealth)) {
    return {
      name: "Backend API",
      url: healthUrl,
      passed: false,
      message: `ERR Backend API - HTTP ${httpPassed ? "ready" : "failed"} but container ${containerHealth.name} is ${containerHealth.status}`,
      fix: buildMismatchFix({
        name: containerHealth.name,
        status: containerHealth.status,
        serviceCommand: "backend",
      }),
    };
  }

  return {
    name: "Backend API",
    url: healthUrl,
    passed: httpPassed,
    message: result.success
      ? `OK  Backend API (${healthUrl})`
      : `ERR Backend API - ${result.error}`,
    fix: result.success
      ? null
      : `\
Possible causes:\
- Backend not started (run: npm run backend:dev)\
- Port ${backendPort} in use (check: lsof -i :${backendPort})\
- Environment vars missing or wrong (check: .env)\
\
Debug:\
$ npm run backend:dev\
`,
  };
}

/**
 * Check frontend
 */
async function checkFrontend() {
  const result = await checkUrl(frontendBaseUrl);
  const containerHealth = getContainerHealth(frontendContainerCandidates);
  const httpPassed = result.success;

  if (isHealthMismatch(httpPassed, containerHealth)) {
    return {
      name: "Frontend",
      url: frontendBaseUrl,
      passed: false,
      message: `ERR Frontend - HTTP ${httpPassed ? "ready" : "failed"} but container ${containerHealth.name} is ${containerHealth.status}`,
      fix: buildMismatchFix({
        name: containerHealth.name,
        status: containerHealth.status,
        serviceCommand: "frontend",
      }),
    };
  }

  return {
    name: "Frontend",
    url: frontendBaseUrl,
    passed: httpPassed,
    message: result.success
      ? `OK  Frontend (${frontendBaseUrl})`
      : `ERR Frontend - ${result.error}`,
    fix: result.success
      ? null
      : `\
Possible causes:\
- Frontend not started (run: npm run dev)\
- Port ${frontendPort} in use (check: lsof -i :${frontendPort})\
\
Debug:\
$ npm run dev\
`,
  };
}

/**
 * Check PostgreSQL (via docker compose service status)
 */
async function checkDatabase() {
  const composeFile = mode === "docker" ? "docker-compose.full.yml" : "docker-compose.deps.yml";

  try {
    execSync(`docker compose --env-file .env.ports -f ${composeFile} ps postgres`, {
      stdio: "ignore",
      cwd: path.resolve(__dirname, "../.."),
    });

    return {
      name: "PostgreSQL",
      url: `localhost:${postgresPort}`,
      passed: true,
      message: `OK  PostgreSQL (localhost:${postgresPort})`,
      fix: null,
    };
  } catch {
    return {
      name: "PostgreSQL",
      url: `localhost:${postgresPort}`,
      passed: false,
      message: "ERR PostgreSQL - Not running",
      fix: `\
Start Docker services:\
$ docker compose --env-file .env.ports -f ${composeFile} up -d\
`,
    };
  }
}

/**
 * Check Redis (via docker compose service status)
 */
async function checkRedis() {
  const composeFile = mode === "docker" ? "docker-compose.full.yml" : "docker-compose.deps.yml";

  try {
    execSync(`docker compose --env-file .env.ports -f ${composeFile} ps redis`, {
      stdio: "ignore",
      cwd: path.resolve(__dirname, "../.."),
    });

    return {
      name: "Redis",
      url: `localhost:${redisPort}`,
      passed: true,
      message: `OK  Redis (localhost:${redisPort})`,
      fix: null,
    };
  } catch {
    return {
      name: "Redis",
      url: `localhost:${redisPort}`,
      passed: false,
      message: "ERR Redis - Not running",
      fix: `\
Start Docker services:\
$ docker compose --env-file .env.ports -f ${composeFile} up -d\
`,
    };
  }
}

/**
 * Check environment variables
 */
async function checkEnvironment() {
  const projectRoot = path.resolve(__dirname, "../..");
  const envLocalPath = path.join(projectRoot, ".env.local");
  const envPath = path.join(projectRoot, ".env");
  const resolvedEnvPath = fs.existsSync(envLocalPath)
    ? envLocalPath
    : fs.existsSync(envPath)
      ? envPath
      : null;
  const envLabel = resolvedEnvPath === envLocalPath ? ".env.local" : ".env";

  if (!resolvedEnvPath) {
    return {
      name: "Environment",
      url: ".env.local",
      passed: false,
      message: "ERR Environment - .env.local or .env file missing",
      fix: `\
Create .env.local file:\
$ npm run setup\
`,
    };
  }

  const required = ["NODE_ENV", "DATABASE_URL", "JWT_SECRET"];
  const envContent = fs.readFileSync(resolvedEnvPath, "utf8");
  const missing = required.filter((key) => !envContent.includes(`${key}=`));

  if (missing.length > 0) {
    return {
      name: "Environment",
      url: envLabel,
      passed: false,
      message: `ERR Environment - Missing vars: ${missing.join(", ")}`,
      fix: `\
Regenerate .env.local file:\
$ rm .env.local && npm run setup\
`,
    };
  }

  return {
    name: "Environment",
    url: envLabel,
    passed: true,
    message: "OK  Environment (all required vars set)",
    fix: null,
  };
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  // Keep output simple and consistent for CI.
  console.log("\nRunning health checks...\n");

  const checks = await Promise.all([
    checkBackend(),
    checkFrontend(),
    checkDatabase(),
    checkRedis(),
    checkEnvironment(),
  ]);

  // Display results
  for (const check of checks) {
    console.log(check.message);
  }

  const allPassed = checks.every((c) => c.passed);
  const failures = checks.filter((c) => !c.passed);

  if (!allPassed) {
    console.log("\nSome checks failed\n");
    for (const check of failures) {
      if (check.fix) {
        console.log(`${check.name}:`);
        console.log(check.fix);
      }
    }
    return false;
  }

  console.log("\nAll systems operational\n");
  return true;
}

/**
 * Display service URLs
 */
function displayServiceUrls() {
  console.log("Service URLs:");
  console.log(`  Frontend:         ${frontendBaseUrl}`);
  console.log(`  Backend:          ${backendBaseUrl}`);
  console.log(`  Supabase API:     http://localhost:${supabaseApiPort}`);
  console.log(`  Supabase Studio:  http://localhost:${supabaseStudioPort}`);
  console.log("");
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthChecks().then((passed) => {
    if (passed) displayServiceUrls();
    process.exit(passed ? 0 : 1);
  });
}

export {
  runHealthChecks,
  checkBackend,
  checkFrontend,
  checkDatabase,
  checkRedis,
  checkEnvironment,
};
