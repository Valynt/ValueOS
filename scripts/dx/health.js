import http from "http";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { buildComposeArgs, getComposeFiles, resolveDxProfiles } from "./compose.js";
import { loadPorts, resolvePort } from "./ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const mode = process.env.DX_MODE || "local";
const profiles = resolveDxProfiles(process.argv.slice(2));
const composeFiles = getComposeFiles({ mode, profiles });

// Port configuration
const portConfig = loadPorts();
const backendPort = resolvePort(process.env.API_PORT, portConfig.backend.port);
const frontendPort = resolvePort(
  process.env.VITE_PORT,
  portConfig.frontend.port
);
const postgresPort = resolvePort(
  process.env.POSTGRES_PORT,
  portConfig.postgres.port
);
const redisPort = resolvePort(process.env.REDIS_PORT, portConfig.redis.port);
const supabaseApiPort = resolvePort(
  process.env.SUPABASE_API_PORT,
  portConfig.supabase.apiPort
);
const caddyHttpPort = resolvePort(
  process.env.CADDY_HTTP_PORT,
  portConfig.edge.httpPort
);

const backendUrl = process.env.BACKEND_URL || `http://localhost:${backendPort}`;
const frontendUrl =
  process.env.FRONTEND_URL || `http://localhost:${frontendPort}`;

let allHealthy = true;
const results = [];

/**
 * Simple health check result
 */
function checkHealth(name, isHealthy, message = "") {
  const status = isHealthy ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} ${name}${message ? `: ${message}` : ""}`);

  results.push({
    name,
    healthy: isHealthy,
    message,
  });

  if (!isHealthy) {
    allHealthy = false;
  }
}

/**
 * Check HTTP endpoint
 */
function checkHttpEndpoint(name, url, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = http.get(url, { timeout }, (res) => {
      const responseTime = Date.now() - startTime;
      const isHealthy = res.statusCode >= 200 && res.statusCode < 300;

      res.on("data", () => {}); // Consume response
      res.on("end", () => {
        resolve({
          healthy: isHealthy,
          message: isHealthy ? `(${responseTime}ms)` : `HTTP ${res.statusCode}`,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        healthy: false,
        message: err.code || err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        healthy: false,
        message: "timeout",
      });
    });
  });
}

/**
 * Check Docker service
 */
function checkDockerService(serviceName) {
  try {
    const composeArgs = buildComposeArgs({ projectDir: projectRoot, files: composeFiles }).join(" ");
    const output = execSync(`docker compose ${composeArgs} ps ${serviceName}`, {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 10000,
    });

    const isRunning = output.includes(serviceName) && !output.includes("Exit");
    return {
      healthy: isRunning,
      message: isRunning ? "running" : "not running",
    };
  } catch (error) {
    return {
      healthy: false,
      message: error.message.includes("timeout") ? "timeout" : "error",
    };
  }
}

/**
 * Main health check execution
 */
async function runHealthChecks() {
  console.log("🏥 Service Health Check\n");

  // Backend API
  const backendResult = await checkHttpEndpoint(
    "Backend API",
    `${backendUrl}/health`
  );
  checkHealth("Backend API", backendResult.healthy, backendResult.message);

  // Frontend
  const frontendResult = await checkHttpEndpoint("Frontend", `${frontendUrl}`);
  checkHealth("Frontend", frontendResult.healthy, frontendResult.message);

  // Gateway /healthz (Caddy)
  const gatewayResult = await checkHttpEndpoint(
    "Gateway",
    `http://localhost:${caddyHttpPort}/healthz`
  );
  checkHealth("Gateway", gatewayResult.healthy, gatewayResult.message);

  // Database (via backend)
  const dbResult = await checkHttpEndpoint(
    "Database",
    `${backendUrl}/health/dependencies`
  );
  checkHealth("Database", dbResult.healthy, dbResult.message);

  // Redis (via backend)
  const redisResult = await checkHttpEndpoint(
    "Redis",
    `${backendUrl}/health/dependencies`
  );
  checkHealth("Redis", redisResult.healthy, redisResult.message);

  // Supabase Auth
  const supabaseAuthResult = await checkHttpEndpoint(
    "Supabase Auth",
    `http://localhost:${supabaseApiPort}/auth/v1/health`
  );
  checkHealth("Supabase Auth", supabaseAuthResult.healthy, supabaseAuthResult.message);

  // Docker services
  const postgresCheck = checkDockerService("postgres");
  checkHealth(
    "PostgreSQL Container",
    postgresCheck.healthy,
    postgresCheck.message
  );

  const redisCheck = checkDockerService("redis");
  checkHealth("Redis Container", redisCheck.healthy, redisCheck.message);

  const backendCheck = checkDockerService("backend");
  checkHealth("Backend Container", backendCheck.healthy, backendCheck.message);

  const frontendCheck = checkDockerService("frontend");
  checkHealth(
    "Frontend Container",
    frontendCheck.healthy,
    frontendCheck.message
  );

  // Summary
  console.log(
    `\n${allHealthy ? "🎉" : "⚠️"} Overall Status: ${allHealthy ? "HEALTHY" : "UNHEALTHY"}`
  );
  console.log(
    `Healthy services: ${results.filter((r) => r.healthy).length}/${results.length}`
  );

  if (!allHealthy) {
    console.log("\nFailed services:");
    results
      .filter((r) => !r.healthy)
      .forEach((result) => {
        console.log(`  - ${result.name}: ${result.message}`);
      });
  }

  process.exit(allHealthy ? 0 : 1);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Simple Health Check Tool

Usage: node health.js [options]

Options:
  --help, -h    Show this help message
  --json        Output results as JSON
  --quiet       Only output exit code, no console output

Exit codes:
  0 - All services healthy
  1 - One or more services unhealthy
`);
  process.exit(0);
}

if (args.includes("--json")) {
  // JSON output mode
  runHealthChecks()
    .then(() => {
      console.log(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            overallHealthy: allHealthy,
            results,
          },
          null,
          2
        )
      );
    })
    .catch(console.error);
} else if (args.includes("--quiet")) {
  // Quiet mode - no output, just exit code
  runHealthChecks().catch(() => process.exit(1));
} else {
  // Normal mode
  runHealthChecks().catch((error) => {
    console.error("Health check failed:", error.message);
    process.exit(1);
  });
}
