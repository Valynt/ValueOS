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
import os from "os";

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
const supabaseStudioPort = resolvePort(
  process.env.SUPABASE_STUDIO_PORT,
  portConfig.supabase.studioPort
);

const backendBaseUrl =
  process.env.BACKEND_URL || `http://localhost:${backendPort}`;
const frontendBaseUrl =
  process.env.VITE_APP_URL || `http://localhost:${frontendPort}`;
const appComposeFile =
  process.env.DX_MODE === "docker"
    ? "infra/docker/docker-compose.dev.yml"
    : "docker-compose.deps.yml";

const backendContainerCandidates = [
  process.env.BACKEND_CONTAINER_NAME,
  "valueos-backend-dev",
  "valueos-backend",
].filter(Boolean);

// Performance monitoring configuration
const PERFORMANCE_CONFIG = {
  slowResponseThreshold: 1000, // ms
  highCpuThreshold: 80, // %
  highMemoryThreshold: 85, // %
  enableExternalMetrics: process.env.HEALTH_METRICS_ENABLED === "true",
  prometheusUrl: process.env.PROMETHEUS_PUSHGATEWAY_URL,
  metricsInterval: 30000, // 30 seconds
};

// Performance metrics storage
let performanceMetrics = {
  system: {
    cpuUsage: [],
    memoryUsage: [],
    timestamps: [],
  },
  services: {
    responseTimes: {},
    errorRates: {},
    availability: {},
  },
};

/**
 * Get system resource usage
 */
function getSystemResources() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const cpuUsage = 100 - ~~((100 * idle) / total);

  const memUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

  return {
    cpu: {
      usage: cpuUsage,
      cores: cpus.length,
    },
    memory: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      external: memUsage.external,
      systemUsed: totalMemory - freeMemory,
      systemTotal: totalMemory,
      usagePercent: memoryUsagePercent,
    },
    loadAverage: os.loadavg(),
    uptime: os.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Update performance metrics
 */
function updatePerformanceMetrics(serviceName, result) {
  const now = Date.now();

  // Track response times
  if (!performanceMetrics.services.responseTimes[serviceName]) {
    performanceMetrics.services.responseTimes[serviceName] = [];
  }

  performanceMetrics.services.responseTimes[serviceName].push({
    time: result.totalTime,
    success: result.success,
    timestamp: now,
  });

  // Keep only last 100 measurements
  if (performanceMetrics.services.responseTimes[serviceName].length > 100) {
    performanceMetrics.services.responseTimes[serviceName] =
      performanceMetrics.services.responseTimes[serviceName].slice(-100);
  }

  // Track error rates
  if (!performanceMetrics.services.errorRates[serviceName]) {
    performanceMetrics.services.errorRates[serviceName] = {
      errors: 0,
      total: 0,
    };
  }

  performanceMetrics.services.errorRates[serviceName].total++;
  if (!result.success) {
    performanceMetrics.services.errorRates[serviceName].errors++;
  }

  // Track availability
  if (!performanceMetrics.services.availability[serviceName]) {
    performanceMetrics.services.availability[serviceName] = [];
  }

  performanceMetrics.services.availability[serviceName].push({
    available: result.success,
    timestamp: now,
  });

  // Keep only last 100 availability checks
  if (performanceMetrics.services.availability[serviceName].length > 100) {
    performanceMetrics.services.availability[serviceName] =
      performanceMetrics.services.availability[serviceName].slice(-100);
  }
}

/**
 * Calculate performance statistics
 */
function calculatePerformanceStats(serviceName) {
  const responseTimes =
    performanceMetrics.services.responseTimes[serviceName] || [];
  const errorRates = performanceMetrics.services.errorRates[serviceName] || {
    errors: 0,
    total: 0,
  };
  const availability =
    performanceMetrics.services.availability[serviceName] || [];

  if (responseTimes.length === 0) {
    return null;
  }

  const times = responseTimes.map((r) => r.time);
  const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minResponseTime = Math.min(...times);
  const maxResponseTime = Math.max(...times);
  const p95ResponseTime = times.sort((a, b) => a - b)[
    Math.floor(times.length * 0.95)
  ];

  const errorRate =
    errorRates.total > 0 ? (errorRates.errors / errorRates.total) * 100 : 0;
  const availabilityPercent =
    availability.length > 0
      ? (availability.filter((a) => a.available).length / availability.length) *
        100
      : 100;

  return {
    averageResponseTime: Math.round(avgResponseTime),
    minResponseTime,
    maxResponseTime,
    p95ResponseTime: Math.round(p95ResponseTime),
    errorRate: Math.round(errorRate * 100) / 100,
    availabilityPercent: Math.round(availabilityPercent * 100) / 100,
    sampleSize: responseTimes.length,
  };
}

/**
 * Send metrics to external monitoring system
 */
async function sendMetricsToExternal(metrics) {
  if (
    !PERFORMANCE_CONFIG.enableExternalMetrics ||
    !PERFORMANCE_CONFIG.prometheusUrl
  ) {
    return;
  }

  try {
    const prometheusMetrics = generatePrometheusMetrics(metrics);
    const response = await fetch(PERFORMANCE_CONFIG.prometheusUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: prometheusMetrics,
    });

    if (!response.ok) {
      console.warn(`Failed to send metrics to Prometheus: ${response.status}`);
    }
  } catch (error) {
    console.warn(`Error sending metrics to external system: ${error.message}`);
  }
}

/**
 * Generate Prometheus-formatted metrics
 */
function generatePrometheusMetrics(metrics) {
  const lines = [];
  const timestamp = Date.now();

  // System metrics
  lines.push(`# HELP health_cpu_usage_percent CPU usage percentage`);
  lines.push(`# TYPE health_cpu_usage_percent gauge`);
  lines.push(
    `health_cpu_usage_percent ${metrics.system.cpu.usage} ${timestamp}`
  );

  lines.push(`# HELP health_memory_usage_percent Memory usage percentage`);
  lines.push(`# TYPE health_memory_usage_percent gauge`);
  lines.push(
    `health_memory_usage_percent ${metrics.system.memory.usagePercent} ${timestamp}`
  );

  lines.push(`# HELP health_memory_used_bytes Memory used in bytes`);
  lines.push(`# TYPE health_memory_used_bytes gauge`);
  lines.push(
    `health_memory_used_bytes ${metrics.system.memory.used} ${timestamp}`
  );

  // Service metrics
  Object.entries(metrics.services).forEach(([serviceName, serviceMetrics]) => {
    if (serviceMetrics.averageResponseTime !== undefined) {
      lines.push(
        `# HELP health_${serviceName}_response_time_ms Average response time in milliseconds`
      );
      lines.push(`# TYPE health_${serviceName}_response_time_ms gauge`);
      lines.push(
        `health_${serviceName}_response_time_ms ${serviceMetrics.averageResponseTime} ${timestamp}`
      );
    }

    if (serviceMetrics.errorRate !== undefined) {
      lines.push(
        `# HELP health_${serviceName}_error_rate_percent Error rate percentage`
      );
      lines.push(`# TYPE health_${serviceName}_error_rate_percent gauge`);
      lines.push(
        `health_${serviceName}_error_rate_percent ${serviceMetrics.errorRate} ${timestamp}`
      );
    }

    if (serviceMetrics.availabilityPercent !== undefined) {
      lines.push(
        `# HELP health_${serviceName}_availability_percent Availability percentage`
      );
      lines.push(`# TYPE health_${serviceName}_availability_percent gauge`);
      lines.push(
        `health_${serviceName}_availability_percent ${serviceMetrics.availabilityPercent} ${timestamp}`
      );
    }
  });

  return lines.join("\n");
}

/**
 * Check if a URL is accessible with performance metrics
 */
async function checkUrl(url, timeout = 5000) {
  const startTime = Date.now();
  let connectStart = 0;
  let connectEnd = 0;

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
      const responseTime = Date.now() - startTime;
      const connectTime = connectEnd - connectStart;

      resolve({
        success: true,
        status: res.statusCode,
        responseTime,
        connectTime: connectTime > 0 ? connectTime : null,
        totalTime: responseTime,
        timestamp: new Date().toISOString(),
      });
    });

    req.on("socket", (socket) => {
      socket.on("connect", () => {
        connectStart = Date.now();
      });

      socket.on("ready", () => {
        connectEnd = Date.now();
      });
    });

    req.on("error", (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        error: error.message,
        responseTime,
        totalTime: responseTime,
        timestamp: new Date().toISOString(),
      });
    });

    req.on("timeout", () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        error: "Timeout",
        responseTime,
        totalTime: responseTime,
        timestamp: new Date().toISOString(),
      });
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
 * Check backend API with performance monitoring
 */
async function checkBackend() {
  const healthUrl = `${backendBaseUrl}/health`;
  const result = await checkUrl(healthUrl);
  const containerHealth = getContainerHealth(backendContainerCandidates);
  const httpPassed = result.success && result.status === 200;

  // Update performance metrics
  updatePerformanceMetrics("backend", result);

  const performanceStats = calculatePerformanceStats("backend");
  const isSlowResponse =
    result.success &&
    result.totalTime > PERFORMANCE_CONFIG.slowResponseThreshold;

  if (isHealthMismatch(httpPassed, containerHealth)) {
    return {
      name: "Backend API",
      url: healthUrl,
      passed: false,
      message: `ERR Backend API - HTTP ${httpPassed ? "ready" : "failed"} but container ${containerHealth.name} is ${containerHealth.status}`,
      performance: performanceStats,
      alerts: isSlowResponse
        ? [
            `Slow response: ${result.totalTime}ms > ${PERFORMANCE_CONFIG.slowResponseThreshold}ms`,
          ]
        : [],
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
      ? `OK  Backend API (${healthUrl}) - ${result.totalTime}ms${isSlowResponse ? " ⚠️" : ""}`
      : `ERR Backend API - ${result.error}`,
    performance: performanceStats,
    alerts: isSlowResponse
      ? [
          `Slow response: ${result.totalTime}ms > ${PERFORMANCE_CONFIG.slowResponseThreshold}ms`,
        ]
      : [],
    fix: result.success
      ? null
      : `\
Possible causes:\
- Backend not started (run: npm run backend:dev)\
- Port ${backendPort} in use (check: lsof -i :${backendPort})\
- Environment vars missing or wrong (check: .env)\

Debug:\
$ npm run backend:dev\
`,
  };
}

/**
 * Check frontend with performance monitoring
 */
async function checkFrontend() {
  const result = await checkUrl(frontendBaseUrl);
  const containerHealth = getContainerHealth(frontendContainerCandidates);
  const httpPassed = result.success;

  // Update performance metrics
  updatePerformanceMetrics("frontend", result);

  const performanceStats = calculatePerformanceStats("frontend");
  const isSlowResponse =
    result.success &&
    result.totalTime > PERFORMANCE_CONFIG.slowResponseThreshold;

  if (isHealthMismatch(httpPassed, containerHealth)) {
    return {
      name: "Frontend",
      url: frontendBaseUrl,
      passed: false,
      message: `ERR Frontend - HTTP ${httpPassed ? "ready" : "failed"} but container ${containerHealth.name} is ${containerHealth.status}`,
      performance: performanceStats,
      alerts: isSlowResponse
        ? [
            `Slow response: ${result.totalTime}ms > ${PERFORMANCE_CONFIG.slowResponseThreshold}ms`,
          ]
        : [],
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
      ? `OK  Frontend (${frontendBaseUrl}) - ${result.totalTime}ms${isSlowResponse ? " ⚠️" : ""}`
      : `ERR Frontend - ${result.error}`,
    performance: performanceStats,
    alerts: isSlowResponse
      ? [
          `Slow response: ${result.totalTime}ms > ${PERFORMANCE_CONFIG.slowResponseThreshold}ms`,
        ]
      : [],
    fix: result.success
      ? null
      : `\
Possible causes:\
- Frontend not started (run: npm run dev)\
- Port ${frontendPort} in use (check: lsof -i :${frontendPort})\

Debug:\
$ npm run dev\
`,
  };
}

/**
 * Check PostgreSQL (via docker compose service status)
 */
async function checkDatabase() {
  const composeFile =
    mode === "docker"
      ? "infra/docker/docker-compose.dev.yml"
      : "docker-compose.deps.yml";

  try {
    execSync(
      `docker compose --env-file .env.ports -f ${composeFile} ps postgres`,
      {
        stdio: "ignore",
        cwd: path.resolve(__dirname, "../.."),
      }
    );

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
  const composeFile =
    mode === "docker"
      ? "infra/docker/docker-compose.dev.yml"
      : "docker-compose.deps.yml";

  try {
    execSync(
      `docker compose --env-file .env.ports -f ${composeFile} ps redis`,
      {
        stdio: "ignore",
        cwd: path.resolve(__dirname, "../.."),
      }
    );

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
 * Check system resources
 */
async function checkSystemResources() {
  const resources = getSystemResources();
  const highCpu = resources.cpu.usage > PERFORMANCE_CONFIG.highCpuThreshold;
  const highMemory =
    resources.memory.usagePercent > PERFORMANCE_CONFIG.highMemoryThreshold;

  const alerts = [];
  if (highCpu) {
    alerts.push(
      `High CPU usage: ${resources.cpu.usage}% > ${PERFORMANCE_CONFIG.highCpuThreshold}%`
    );
  }
  if (highMemory) {
    alerts.push(
      `High memory usage: ${resources.memory.usagePercent.toFixed(1)}% > ${PERFORMANCE_CONFIG.highMemoryThreshold}%`
    );
  }

  // Update system metrics history
  performanceMetrics.system.cpuUsage.push(resources.cpu.usage);
  performanceMetrics.system.memoryUsage.push(resources.memory.usagePercent);
  performanceMetrics.system.timestamps.push(resources.timestamp);

  // Keep only last 10 system metrics
  const maxHistory = 10;
  if (performanceMetrics.system.cpuUsage.length > maxHistory) {
    performanceMetrics.system.cpuUsage =
      performanceMetrics.system.cpuUsage.slice(-maxHistory);
    performanceMetrics.system.memoryUsage =
      performanceMetrics.system.memoryUsage.slice(-maxHistory);
    performanceMetrics.system.timestamps =
      performanceMetrics.system.timestamps.slice(-maxHistory);
  }

  return {
    name: "System Resources",
    url: "localhost",
    passed: !highCpu && !highMemory,
    message: `OK  System Resources - CPU: ${resources.cpu.usage}%, Memory: ${resources.memory.usagePercent.toFixed(1)}%${alerts.length > 0 ? " ⚠️" : ""}`,
    system: resources,
    alerts,
    fix:
      alerts.length > 0
        ? `\
System resource alerts detected. Consider:\
- Monitor CPU/memory intensive processes\
- Check for memory leaks\
- Consider scaling resources\
- Review recent deployments\
`
        : null,
  };
}

/**
 * Run all health checks with performance monitoring
 */
async function runHealthChecks() {
  console.log("\nRunning health checks...\n");

  const checks = await Promise.all([
    checkBackend(),
    checkFrontend(),
    checkDatabase(),
    checkRedis(),
    checkEnvironment(),
    checkSystemResources(),
  ]);

  // Collect all alerts
  const allAlerts = checks.flatMap((check) => check.alerts || []);

  // Display results
  for (const check of checks) {
    console.log(check.message);
  }

  // Display performance summary if metrics are available
  const hasPerformanceData = checks.some((check) => check.performance);
  if (hasPerformanceData) {
    console.log("\n📊 Performance Summary:");
    checks.forEach((check) => {
      if (check.performance) {
        const perf = check.performance;
        console.log(`  ${check.name}:`);
        console.log(
          `    Response Time: ${perf.averageResponseTime}ms (P95: ${perf.p95ResponseTime}ms)`
        );
        console.log(`    Error Rate: ${perf.errorRate}%`);
        console.log(`    Availability: ${perf.availabilityPercent}%`);
        console.log(`    Sample Size: ${perf.sampleSize}`);
      }
    });

    // Send metrics to external monitoring if enabled
    const metrics = {
      system: checks.find((c) => c.system)?.system,
      services: {},
    };

    checks.forEach((check) => {
      if (check.performance) {
        metrics.services[check.name.toLowerCase().replace(/\s+/g, "")] =
          check.performance;
      }
    });

    await sendMetricsToExternal(metrics);
  }

  // Display alerts if any
  if (allAlerts.length > 0) {
    console.log("\n🚨 Performance Alerts:");
    allAlerts.forEach((alert) => console.log(`  ⚠️  ${alert}`));
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

  console.log("\n✅ All systems operational\n");
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
