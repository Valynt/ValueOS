/**
 * Consolidated Health Check Implementation
 *
 * Single TypeScript implementation providing comprehensive health checks
 * for all system dependencies and Kubernetes probes.
 *
 * Consolidates:
 * - src/health.js (legacy JS implementation)
 * - src/api/health.ts (comprehensive TS implementation)
 * - Various shell scripts and configs
 */

import * as path from "path";

import { alertManager } from "@shared/lib/health/alerts";
import { healthMetrics } from "@shared/lib/health/metrics";
import { createClient } from "@supabase/supabase-js";
import { Request, Response, Router } from "express";

import { validateEnv } from "../../config/validateEnv.js"
import { rateLimiters } from "../../middleware/rateLimiter.js"
import { requestAuditMiddleware } from "../../middleware/requestAuditMiddleware.js"
import { securityHeadersMiddleware } from "../../middleware/securityHeaders.js"
import { serviceIdentityMiddleware } from "../../middleware/serviceIdentityMiddleware.js"
import { checkAllT1TableFreshness } from "../../observability/dataFreshness.js"
import { getQueueHealth } from "../../observability/queueMetrics.js"
import { getCrmSyncQueue, getCrmWebhookQueue, getPrefetchQueue } from "../../workers/crmWorker.js"
import { getResearchQueue } from "../../workers/researchWorker.js"



const router = Router();

// Health endpoint authentication middleware
const healthAuthMiddleware = (req: Request, res: Response, next: Function) => {
  const authEnabled = process.env.HEALTH_AUTH_ENABLED === "true";
  if (!authEnabled) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const expectedToken = process.env.HEALTH_AUTH_TOKEN;

  if (!expectedToken) {
    return res
      .status(500)
      .json({ error: "Health authentication not configured" });
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  // eslint-disable-next-line security/detect-possible-timing-attacks -- not a cryptographic comparison
  if (token !== expectedToken) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }

  next();
};

// Apply middleware
router.use(requestAuditMiddleware());
router.use(securityHeadersMiddleware);
router.use(serviceIdentityMiddleware);
router.use(rateLimiters.loose);

// Shutdown state
let isShuttingDown = false;

/**
 * Mark application as shutting down
 * Triggers 503 on readiness probe
 */
export function markAsShuttingDown() {
  isShuttingDown = true;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: { [key: string]: HealthStatus };
  warnings?: string[];
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy" | "not_configured";
  latency?: number;
  message?: string;
  lastChecked: string;
}

/**
 * Check Together.ai API connectivity
 */
async function checkTogetherAI(): Promise<HealthStatus> {
  const startTime = Date.now();

  if (!process.env.TOGETHER_API_KEY) {
    return {
      status: "not_configured",
      message: "Together.ai API key not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  try {
     
    const response = await fetch("https://api.together.ai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        status: latency < 2000 ? "healthy" : "degraded",
        latency,
        message:
          latency < 2000
            ? "Together.ai API responding normally"
            : "Together.ai API slow",
        lastChecked: new Date().toISOString(),
      };
    } else {
      const errorText = await response.text();
      return {
        status: "unhealthy",
        latency,
        message: `Together.ai API error: ${response.status} - ${errorText}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - startTime,
      message: `Together.ai API unreachable: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check OpenAI API connectivity (fallback)
 */
async function checkOpenAI(): Promise<HealthStatus> {
  const startTime = Date.now();

  if (!process.env.OPENAI_API_KEY) {
    return {
      status: "not_configured",
      message: "OpenAI API key not configured (fallback not available)",
      lastChecked: new Date().toISOString(),
    };
  }

  try {
     
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        status: "healthy",
        latency,
        message: "OpenAI API available as fallback",
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: "unhealthy",
        latency,
        message: `OpenAI API error: ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - startTime,
      message: `OpenAI API unreachable: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Supabase connectivity
 */
async function checkSupabase(): Promise<HealthStatus> {
  const startTime = Date.now();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      status: "not_configured",
      message: "Supabase not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from("tenants")
      .select("id")
      .limit(1);

    const latency = Date.now() - startTime;

    if (!error) {
      return {
        status: latency < 1000 ? "healthy" : "degraded",
        latency,
        message: "Supabase responding normally",
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: "unhealthy",
        latency,
        message: `Supabase error: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - startTime,
      message: `Supabase unreachable: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check database connectivity (Supabase Postgres)
 */
async function checkDatabase(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
    );

    const { error } = await supabase.from("tenants").select("id").limit(1);

    const latency = Date.now() - startTime;

    if (!error) {
      return {
        status: "healthy",
        latency,
        message: "Database responding normally",
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: "unhealthy",
        latency,
        message: `Database error: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - startTime,
      message: `Database unreachable: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<HealthStatus> {
  const startTime = Date.now();

  if (!process.env.REDIS_URL) {
    return {
      status: "not_configured",
      message: "Redis not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { getRedisClient } = await import("../../lib/redisClient.js");
    const redisClient = getRedisClient();

    // Add timeout to prevent hanging on unresponsive Redis
    const pingPromise = redisClient.ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Redis ping timeout")), 5000)
    );

    await Promise.race([pingPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    return {
      status: "healthy",
      latency,
      message: "Redis responding normally",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - startTime,
      message: `Redis error: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Comprehensive health check
 */
router.get(["/health", "/api/health"], async (req: Request, res: Response) => {
  // Configuration from environment variables
  const enabledChecks = {
    database: process.env.HEALTH_CHECK_DATABASE !== "false",
    supabase: process.env.HEALTH_CHECK_SUPABASE !== "false",
    togetherAI: process.env.HEALTH_CHECK_TOGETHER_AI !== "false",
    openAI: process.env.HEALTH_CHECK_OPENAI !== "false",
    redis: process.env.HEALTH_CHECK_REDIS !== "false",
  };

  const checkPromises: Promise<HealthStatus>[] = [];

  if (enabledChecks.database) checkPromises.push(checkDatabase());
  if (enabledChecks.supabase) checkPromises.push(checkSupabase());
  if (enabledChecks.togetherAI) checkPromises.push(checkTogetherAI());
  if (enabledChecks.openAI) checkPromises.push(checkOpenAI());
  if (enabledChecks.redis) checkPromises.push(checkRedis());

  const results = await Promise.all(checkPromises);

  // Map results back to check names
  const checks: { [key: string]: HealthStatus } = {};
  let idx = 0;
  if (enabledChecks.database) checks.database = results[idx++];
  if (enabledChecks.supabase) checks.supabase = results[idx++];
  if (enabledChecks.togetherAI) checks.togetherAI = results[idx++];
  if (enabledChecks.openAI) checks.openAI = results[idx++];
  if (enabledChecks.redis) checks.redis = results[idx++];

  // Determine overall status
  const criticalChecks = [
    enabledChecks.database ? checks.database : null,
    enabledChecks.supabase ? checks.supabase : null,
    enabledChecks.togetherAI ? checks.togetherAI : null,
  ].filter(Boolean) as HealthStatus[];

  const hasUnhealthy = criticalChecks.some(
    (check) => check.status === "unhealthy"
  );
  const hasDegraded = criticalChecks.some(
    (check) => check.status === "degraded"
  );

  let overallStatus: "healthy" | "degraded" | "unhealthy";
  if (hasUnhealthy) {
    overallStatus = "unhealthy";
  } else if (hasDegraded) {
    overallStatus = "degraded";
  } else {
    overallStatus = "healthy";
  }

  // Record health snapshot for trend analysis
  healthMetrics.recordHealthSnapshot(overallStatus, checks);

  // Surface env-level warnings (e.g. MFA disabled in production) in the health response
  const { warnings: envWarnings } = validateEnv();

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || "1.0.0",
    uptime: process.uptime(),
    checks,
    warnings: envWarnings.length > 0 ? envWarnings : undefined,
    // Only expose detailed metrics when authenticated or when explicitly requested
    metrics: req.headers.authorization
      ? {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        }
      : undefined,
  };

  // Return appropriate status code
  const statusCode =
    overallStatus === "healthy"
      ? 200
      : overallStatus === "degraded"
        ? 200
        : 503;

  res.status(statusCode).json(result);
});

/**
 * Liveness probe (for Kubernetes) - legacy compatibility
 * Now checks critical dependencies for Docker healthcheck
 */
router.get("/healthz", async (_req: Request, res: Response) => {
  try {
    // Check critical dependencies: Supabase and Redis
    const [supabaseCheck, redisCheck] = await Promise.all([
      checkSupabase(),
      checkRedis(),
    ]);

    // Determine if healthy based on critical dependencies
    const isHealthy =
      supabaseCheck.status !== "unhealthy" && redisCheck.status !== "unhealthy";

    const result = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks: {
        supabase: supabaseCheck,
        redis: redisCheck,
      },
    };

    // Return 200 if healthy, 503 if unhealthy
    res.status(isHealthy ? 200 : 503).json(result);
  } catch (error) {
    // If checks fail entirely, return unhealthy
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      error: error instanceof Error ? error.message : "Health check failed",
    });
  }
});

/**
 * Readiness probe (for Kubernetes)
 */
router.get("/ready", async (_req: Request, res: Response) => {
  // Check if shutting down
  if (isShuttingDown) {
    res.status(503).json({
      status: "shutting_down",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const isReady =
      database.status !== "unhealthy" && redis.status !== "unhealthy";

    if (isReady) {
      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: { database, redis },
      });
    } else {
      res.status(503).json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        checks: { database, redis },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness probe (for Kubernetes)
 */
router.get("/health/live", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe (for Kubernetes)
 */
router.get("/health/ready", async (_req: Request, res: Response) => {
  // Check if shutting down
  if (isShuttingDown) {
    res.status(503).json({
      status: "shutting_down",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const isReady =
      database.status !== "unhealthy" && redis.status !== "unhealthy";

    if (isReady) {
      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: { database, redis },
      });
    } else {
      res.status(503).json({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        checks: { database, redis },
      });
    }
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Startup probe (for Kubernetes)
 */
router.get("/health/startup", async (_req: Request, res: Response) => {
  const isStarted = process.uptime() > 10; // Application has been running for at least 10 seconds

  if (isStarted) {
    res.status(200).json({
      status: "started",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: "starting",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Detailed dependency status
 */
router.get("/health/dependencies", async (_req: Request, res: Response) => {
  // Configuration from environment variables
  const enabledChecks = {
    database: process.env.HEALTH_CHECK_DATABASE !== "false",
    supabase: process.env.HEALTH_CHECK_SUPABASE !== "false",
    togetherAI: process.env.HEALTH_CHECK_TOGETHER_AI !== "false",
    openAI: process.env.HEALTH_CHECK_OPENAI !== "false",
    redis: process.env.HEALTH_CHECK_REDIS !== "false",
  };

  const checkPromises: Promise<HealthStatus>[] = [];

  if (enabledChecks.database) checkPromises.push(checkDatabase());
  if (enabledChecks.supabase) checkPromises.push(checkSupabase());
  if (enabledChecks.togetherAI) checkPromises.push(checkTogetherAI());
  if (enabledChecks.openAI) checkPromises.push(checkOpenAI());
  if (enabledChecks.redis) checkPromises.push(checkRedis());

  const results = await Promise.all(checkPromises);

  // Map results back to check names
  const checks: { [key: string]: HealthStatus } = {};
  let idx = 0;
  if (enabledChecks.database) checks.database = results[idx++];
  if (enabledChecks.supabase) checks.supabase = results[idx++];
  if (enabledChecks.togetherAI) checks.togetherAI = results[idx++];
  if (enabledChecks.openAI) checks.openAI = results[idx++];
  if (enabledChecks.redis) checks.redis = results[idx++];

  // Data freshness — T1 tables. Uses a representative system org ID for the
  // cross-tenant freshness check; individual tenant freshness is tracked by
  // the 5-minute cron in the observability module.
  const systemOrgId = process.env.SYSTEM_ORG_ID ?? "";
  let dataFreshness: Record<string, unknown> | undefined;
  if (systemOrgId) {
    try {
      const freshnessResults = await checkAllT1TableFreshness(systemOrgId);
      dataFreshness = Object.fromEntries(
        freshnessResults.map((r) => [
          r.table,
          { status: r.status, lagMinutes: r.lagMinutes !== null ? Math.round(r.lagMinutes) : null },
        ]),
      );
    } catch {
      dataFreshness = { error: "freshness check unavailable" };
    }
  }

  // Queue health — all registered BullMQ queues.
  let queues: Record<string, unknown> | undefined;
  try {
    const queueEntries = await Promise.all([
      getQueueHealth(getCrmSyncQueue(), "crm-sync"),
      getQueueHealth(getCrmWebhookQueue(), "crm-webhook"),
      getQueueHealth(getPrefetchQueue(), "crm-prefetch"),
      getQueueHealth(getResearchQueue(), "onboarding-research"),
    ]);
    queues = Object.fromEntries(
      queueEntries.map((q) => [
        q.queue,
        {
          waiting: q.waiting,
          active: q.active,
          delayed: q.delayed,
          failed: q.failed,
          stalledCount: q.stalledCount,
          lastFailedAt: q.lastFailedAt,
        },
      ]),
    );
  } catch {
    queues = { error: "queue health unavailable" };
  }

  res.json({
    timestamp: new Date().toISOString(),
    checks,
    ...(dataFreshness ? { data_freshness: dataFreshness } : {}),
    ...(queues ? { queues } : {}),
  });
});

/**
 * Health check metrics endpoint
 */
router.get(
  "/health/metrics",
  healthAuthMiddleware,
  (req: Request, res: Response) => {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour

    const serviceStats = healthMetrics.getServiceStats(timeWindowMs);

    res.json({
      timestamp: new Date().toISOString(),
      timeWindowMs,
      services: serviceStats,
    });
  }
);

/**
 * Health check alerts endpoint
 */
router.get(
  "/health/alerts",
  healthAuthMiddleware,
  (req: Request, res: Response) => {
    const activeOnly = req.query.active === "true";
    const alerts = activeOnly
      ? alertManager.getActiveAlerts()
      : alertManager.getAllAlerts();

    res.json({
      timestamp: new Date().toISOString(),
      alerts,
    });
  }
);

/**
 * Health history and trends endpoint
 */
router.get(
  "/health/history",
  healthAuthMiddleware,
  (req: Request, res: Response) => {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour
    const includeTrends = req.query.trends === "true";

    const history = healthMetrics.getHealthHistory(timeWindowMs);
    const trends = includeTrends
      ? healthMetrics.getHealthTrends(timeWindowMs)
      : undefined;

    res.json({
      timestamp: new Date().toISOString(),
      timeWindowMs,
      history,
      trends,
    });
  }
);

/**
 * Health dashboard
 */
router.get("/health/dashboard", (_req: Request, res: Response) => {
  const dashboardPath = path.join(
    process.cwd(),
    "public",
    "health-dashboard.html"
  );

  res.sendFile(dashboardPath, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: "Dashboard not available" });
      }
    }
  });
});

/**
 * Health dashboard JS
 */
router.get("/health/health-dashboard.js", (_req: Request, res: Response) => {
  const jsPath = path.join(
    process.cwd(),
    "public",
    "health-dashboard.js"
  );

  res.sendFile(jsPath, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: "Dashboard JS not available" });
      }
    }
  });
});

/**
 * Acknowledge alert endpoint
 */
router.post(
  "/health/alerts/:alertId/acknowledge",
  healthAuthMiddleware,
  (req: Request, res: Response) => {
    const { alertId } = req.params;
    const acknowledged = alertManager.acknowledgeAlert(alertId);

    if (acknowledged) {
      res.json({ success: true, message: "Alert acknowledged" });
    } else {
      res.status(404).json({ success: false, message: "Alert not found" });
    }
  }
);

/**
 * Memory subsystem health check.
 *
 * Verifies the semantic_memory table is reachable and returns row counts
 * per organization (aggregated, no content). Used by ops dashboards to
 * confirm durable agent memory is writing correctly.
 */
router.get("/health/memory", async (_req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { createServiceRoleSupabaseClient } = await import("../../lib/supabase.js");
    const supabase = createServiceRoleSupabaseClient();

    const { count, error } = await supabase
      .from("semantic_memory")
      .select("*", { count: "exact", head: true });

    const latency = Date.now() - startTime;

    if (error) {
      return res.status(503).json({
        status: "unhealthy",
        latency,
        message: `semantic_memory unreachable: ${error.message}`,
        lastChecked: new Date().toISOString(),
      });
    }

    return res.json({
      status: latency < 500 ? "healthy" : "degraded",
      latency,
      message: `semantic_memory reachable — ${count ?? 0} total rows`,
      row_count: count ?? 0,
      lastChecked: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(503).json({
      status: "unhealthy",
      latency: Date.now() - startTime,
      message: `Memory health check failed: ${err instanceof Error ? err.message : String(err)}`,
      lastChecked: new Date().toISOString(),
    });
  }
});

export default router;
