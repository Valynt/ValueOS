/**
 * Backend Server for Billing API
 * Minimal Express server for secure billing operations
 */

// CRITICAL: Load environment variables FIRST before any other imports
// import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

// Load .env.local from project root
// dotenv.config({ path: path.join(projectRoot, ".env.local") });

// Validate required environment variables (fail fast)
validateEnvOrThrow();

logger.info("[Instrumentation] Environment validation passed");

// Now safe to import modules that depend on env vars
logger.info("[Instrumentation] Starting module imports...");

import express from "express";
logger.info("[Instrumentation] Express imported successfully");

import cors from "cors";
logger.info("[Instrumentation] CORS imported successfully");

import { createServer, type IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import billingRouter from "./api/billing/index.js";
import agentsRouter from "./api/agents.js";
import groundtruthRouter from "./api/groundtruth.js";
import llmRouter from "./api/llm.js";
import workflowRouter from "./api/workflow.js";
import documentRouter from "./api/documents.js";
import healthRouter, { markAsShuttingDown } from "./api/health/index.js";
import authRouter from "./api/auth.js";
import adminRouter from "./api/admin.js";
import securityMonitoringRouter from "./api/securityMonitoring.js";
import referralsRouter from "./api/referrals.js";
import projectsRouter from "./api/projects.js";
import analyticsRouter from "./api/analytics.js";
import initiativesRouter from "./api/initiatives/index.js";
import teamsRouter from "./api/teams.js";
import integrationsRouter from "./api/integrations.js";
import crmRouter from "./api/crm.js";
import onboardingRouter from "./api/onboarding.js";
import { initResearchWorker } from "./workers/researchWorker.js";
import { initCrmWorkers } from "./workers/crmWorker.js";
import { createCheckpointRouter } from "./api/checkpoints.js";
import { getUnifiedOrchestrator } from "./services/UnifiedAgentOrchestrator.js";
import docsApiRouter from "./docs-api/index.js";
import {
  initializeSecretVolumeWatcher,
  secretVolumeWatcher,
} from "./config/secrets/SecretVolumeWatcher";
import {
  validateSecretsOnStartup,
  secretHealthMiddleware,
} from "./config/secrets/SecretValidator.js";
import { validateEnvOrThrow } from "./config/validateEnv.js";
const initializeContext = async () => {};
import { createVersionedApiRouter } from "./versioning.js";
import { registerDevRoutes } from "./routes/devRoutes.js";

// Conditionally import telemetry modules
let tracingMiddleware = null;
let latencyMetricsMiddleware = null;
let metricsMiddleware = null;
let getMetricsRegistry = null;
let getLatencySnapshot = null;

if (process.env.ENABLE_TELEMETRY !== "false") {
  try {
    const telemetryModule = await import("./config/telemetry");
    tracingMiddleware = telemetryModule.tracingMiddleware;

    const latencyModule = await import("./middleware/latencyMetricsMiddleware");
    latencyMetricsMiddleware = latencyModule.latencyMetricsMiddleware;
    getLatencySnapshot = latencyModule.getLatencySnapshot;

    const metricsModule = await import("./middleware/metricsMiddleware");
    metricsMiddleware = metricsModule.metricsMiddleware;
    getMetricsRegistry = metricsModule.getMetricsRegistry;
  } catch (error) {
    console.warn("Telemetry modules not available, running without observability");
  }
}

import { requestAuditMiddleware } from "./middleware/requestAuditMiddleware.js";
import { createRateLimiter } from "./middleware/rateLimiter.js";
import {
  requestIdMiddleware,
  accessLogMiddleware,
  globalErrorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from "./middleware/globalErrorHandler";
import { serviceIdentityMiddleware } from "./middleware/serviceIdentityMiddleware.js";
import { securityHeadersMiddleware, cspReportHandler } from "./middleware/securityHeaders.js";
import { cachingMiddleware } from "./middleware/cachingMiddleware.js";
import { csrfProtectionMiddleware } from "./middleware/securityMiddleware.js";
import { extractTenantId, requireAuth, verifyAccessToken } from "./middleware/auth.js";
import { tenantContextMiddleware } from "./middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "./middleware/tenantDbContext.js";
import { settings } from "./config/settings.js";
import { isConsentRegistryConfigured } from "./services/consentRegistry.js";
import { TenantContextResolver } from "./services/TenantContextResolver.js";
import { logger } from "./lib/logger.js";
const WS_POLICY_VIOLATION_CODE = 1008;

const app = express();
app.set("trust proxy", true);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/sdui" });
const PORT = settings.API_PORT;
const apiRouter = createVersionedApiRouter();
const agentExecutionLimiter = createRateLimiter("strict", {
  message: "Too many agent calls. Please wait before trying again.",
  skip: (req) => req.method === "GET",
});

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  tenantId: string;
}

const tenantResolver = new TenantContextResolver();

function parseBearerToken(header?: string | string[]): string | null {
  if (!header) return null;
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (!headerValue) return null;
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) return null;
  const token = headerValue.slice(prefix.length).trim();
  return token.length > 0 ? token : null;
}

function getWebSocketToken(req: IncomingMessage): string | null {
  const bearerToken = parseBearerToken(req.headers.authorization);
  if (bearerToken) {
    return bearerToken;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  if (process.env.NODE_ENV !== "production") {
    return url.searchParams.get("access_token") ?? url.searchParams.get("token");
  }
  return null;
}

function getRequestedTenantId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "", "http://localhost");
  return (
    url.searchParams.get("tenantId") ??
    url.searchParams.get("tenant_id") ??
    url.searchParams.get("organization_id")
  );
}

async function authenticateWebSocket(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const clientIp = req.socket.remoteAddress;
  const token = getWebSocketToken(req);

  if (!token) {
    logger.warn("WebSocket authentication failed: missing token", { clientIp });
    ws.close(WS_POLICY_VIOLATION_CODE, "Authentication required");
    return;
  }

  const verified = await verifyAccessToken(token);
  if (!verified) {
    logger.warn("WebSocket authentication failed: invalid token", { clientIp });
    ws.close(WS_POLICY_VIOLATION_CODE, "Invalid token");
    return;
  }

  const claims = verified.claims ?? null;
  const userId = verified.user?.id ?? claims?.sub;

  if (!userId) {
    logger.warn("WebSocket authentication failed: missing user id", {
      clientIp,
    });
    ws.close(WS_POLICY_VIOLATION_CODE, "Invalid token");
    return;
  }

  let tenantId = extractTenantId(claims, verified.user);
  if (!tenantId) {
    const requestedTenantId = getRequestedTenantId(req);
    if (requestedTenantId) {
      const hasAccess = await tenantResolver.hasTenantAccess(userId, requestedTenantId);
      if (!hasAccess) {
        logger.warn("WebSocket authentication failed: tenant access denied", {
          clientIp,
          userId,
          requestedTenantId,
        });
        ws.close(WS_POLICY_VIOLATION_CODE, "Tenant access denied");
        return;
      }
      tenantId = requestedTenantId;
    }
  }

  if (!tenantId) {
    logger.warn("WebSocket authentication failed: missing tenant context", {
      clientIp,
      userId,
    });
    ws.close(WS_POLICY_VIOLATION_CODE, "Tenant context required");
    return;
  }

  const authedSocket = ws as AuthenticatedWebSocket;
  authedSocket.userId = userId;
  authedSocket.tenantId = tenantId;

  logger.info("WebSocket client connected", { clientIp, userId, tenantId });

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      logger.debug("WebSocket message received", {
        type: message.type,
        messageId: message.messageId,
      });

      switch (message.type) {
        case "sdui_update": {
          const senderTenantId = authedSocket.tenantId;
          wss.clients.forEach((client) => {
            const recipient = client as AuthenticatedWebSocket;
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              recipient.tenantId === senderTenantId
            ) {
              client.send(
                JSON.stringify({
                  type: "sdui_update",
                  data: message.payload,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          });
          break;
        }

        case "ping":
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            })
          );
          break;

        default:
          logger.warn("Unknown WebSocket message type", { type: message.type });
      }
    } catch (error) {
      logger.error("Error handling WebSocket message", error instanceof Error ? error : undefined);
    }
  });

  ws.on("close", () => {
    logger.info("WebSocket client disconnected", {
      clientIp,
      userId,
      tenantId,
    });
  });

  ws.on("error", (error) => {
    logger.error("WebSocket error", error instanceof Error ? error : undefined);
  });
}

// WebSocket connection handling
wss.on("connection", (ws: WebSocket, req) => {
  void authenticateWebSocket(ws, req);
});

// Middleware
const corsOrigins = settings.security.corsOrigins;
if (corsOrigins.includes("*") || corsOrigins.length === 0) {
  throw new Error('CORS origins cannot include "*" or be empty when credentials are enabled');
}
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(requestIdMiddleware); // Request ID and timing (must be early)
app.use(accessLogMiddleware); // Access logging
app.use(securityHeadersMiddleware);
app.use(cachingMiddleware); // HTTP caching headers
app.use((req, res, next) => {
  const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (stateChangingMethods.has(req.method)) {
    return csrfProtectionMiddleware(req, res, next);
  }
  next();
});

// Conditionally add telemetry middleware
if (tracingMiddleware) {
  app.use(tracingMiddleware()); // Add tracing middleware early
}
if (metricsMiddleware) {
  app.use(metricsMiddleware());
}
if (latencyMetricsMiddleware) {
  app.use(latencyMetricsMiddleware());
}

app.use(requestAuditMiddleware());

// Health check
app.use(healthRouter);

// Conditionally add metrics endpoint
if (getMetricsRegistry) {
  app.get(
    "/metrics",
    serviceIdentityMiddleware,
    async (_req: express.Request, res: express.Response) => {
      const registry = getMetricsRegistry();
      res.set("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    }
  );
}

// Conditionally add latency metrics endpoint
if (typeof getLatencySnapshot === "function") {
  app.get("/metrics/latency", serviceIdentityMiddleware, (_req, res) => {
    res.json({
      routes: getLatencySnapshot(),
      timestamp: new Date().toISOString(),
    });
  });
}
// CSP Reporting Endpoint
app.post("/api/csp-report", express.json({ type: "application/csp-report" }), cspReportHandler);

// Secret Health Check Endpoint
app.get("/health/secrets", secretHealthMiddleware());

// Mount routes
apiRouter.use("/billing", billingRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use(
  "/initiatives",
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  initiativesRouter
);
app.use("/api", apiRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/security", securityMonitoringRouter);
app.use(
  "/api/agents",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  agentExecutionLimiter,
  agentsRouter
);
app.use(
  "/api/groundtruth",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  agentExecutionLimiter,
  groundtruthRouter
);
app.use("/api/llm", llmRouter);
app.use("/api", workflowRouter);
app.use(
  "/api/documents",
  requireAuth,
  tenantContextMiddleware(),
  tenantDbContextMiddleware(),
  documentRouter
);
app.use("/api/docs", docsApiRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/crm", crmRouter);
app.use("/api/onboarding", onboardingRouter);

// Mount checkpoint HITL endpoints
const orchestrator = getUnifiedOrchestrator();
const checkpointMiddleware = orchestrator.getCheckpointMiddleware();
if (checkpointMiddleware) {
  app.use("/api/checkpoints", createCheckpointRouter(checkpointMiddleware));
}

await registerDevRoutes(app);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

async function startServer(): Promise<void> {
  logger.info("[Instrumentation] Starting backend server initialization");

  // 0. Setup global error handlers for unhandled rejections/exceptions
  logger.info("[Instrumentation] Setting up global error handlers");
  setupGlobalErrorHandlers();

  // 1. Validate all secrets before starting any services (production only)
  if (settings.NODE_ENV === "production") {
    logger.info("🔒 Validating secrets before server startup");
    await validateSecretsOnStartup();
    logger.info("✅ Secret validation completed successfully");
  }

  // 2. Validate production requirements
  logger.info("[Instrumentation] Validating production requirements");
  if (settings.NODE_ENV === "production" && !isConsentRegistryConfigured()) {
    throw new Error(
      "Consent registry is not configured. Verify consent registry Supabase URL and authentication configuration."
    );
  }

  // 3. Initialize infrastructure
  logger.info("[Instrumentation] Initializing infrastructure");
  await initializeContext();
  await initializeSecretVolumeWatcher();

  if (secretVolumeWatcher) {
    secretVolumeWatcher.on("reload-required", (event) => {
      logger.warn("Graceful shutdown initiated due to secret change", {
        secretKey: event.secretKey,
      });

      // 1. Notify LB to stop sending traffic
      markAsShuttingDown();

      // 2. Stop accepting new connections
      const SHUTDOWN_TIMEOUT = 10000; // 10 seconds
      server.close(() => {
        logger.info("Server closed, exiting process");
        process.exit(0);
      });

      // 3. Force exit if connections don't drain in time
      setTimeout(() => {
        logger.error("Forcing exit after timeout");
        process.exit(1);
      }, SHUTDOWN_TIMEOUT);
    });
  }

  // 4. Start the onboarding research BullMQ worker (in-process)
  try {
    initResearchWorker();
    console.log("[Instrumentation] Research worker initialized");
  } catch (workerErr) {
    // Non-fatal — server can run without the worker (e.g. no Redis)
    console.warn("[Instrumentation] Research worker failed to start:", workerErr);
  }

  // 5. Start CRM integration BullMQ workers (in-process)
  try {
    initCrmWorkers();
    console.log("[Instrumentation] CRM workers initialized");
  } catch (workerErr) {
    console.warn("[Instrumentation] CRM workers failed to start:", workerErr);
  }

  server.listen(PORT, () => {
    logger.info(`[Instrumentation] Server listening on port ${PORT}`);
    logger.info(`Billing API server with WebSocket support running on port ${PORT}`, {
      url: `http://localhost:${PORT}`,
      webSocketUrl: `ws://localhost:${PORT}/ws/sdui`,
      healthCheck: `http://localhost:${PORT}/health`,
    });
  });
}

const isMainModule =
  typeof require !== "undefined" && typeof module !== "undefined" && require.main === module;

// Start server when executed directly (or when running via tsx watch in development)
if (isMainModule || settings.NODE_ENV === "development") {
  void startServer();
}

// ============================================================================
// Agent Reasoning Broadcast Helper
// ============================================================================

/**
 * Broadcast a reasoning chain update to all authenticated WebSocket clients
 * in the specified tenant. Matches the event format expected by
 * AgentReasoningViewer: { type: 'agent.event', payload: { eventType, data } }
 */
function broadcastReasoningUpdate(tenantId: string, chain: unknown): void {
  const message = JSON.stringify({
    type: "agent.event",
    payload: {
      eventType: "agent.reasoning.update",
      data: chain,
    },
  });

  wss.clients.forEach((client) => {
    const authed = client as AuthenticatedWebSocket;
    if (authed.tenantId === tenantId && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export { app, server, wss, broadcastReasoningUpdate };
export default app;
