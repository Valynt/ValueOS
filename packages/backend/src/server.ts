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

logger.info("[Instrumentation] Express imported successfully");

logger.info("[Instrumentation] CORS imported successfully");

import { createServer, type IncomingMessage } from "http";

import { initializeContext } from "@shared/lib/context";
import express from "express";
import type { Application, Request, Response, NextFunction } from "express";
import { type RawData, WebSocket, WebSocketServer } from "ws";

import adminRouter from "./api/admin.js";
import { agentAdminRouter } from "./api/agentAdmin.js";
import artifactsRouter from "./api/artifacts.js";
import agentsRouter from "./api/agents.js";
import analyticsRouter from "./api/analytics.js";
import { createApprovalWebhookRouter } from "./api/approvalWebhooks.js";
import { approvalInboxRouter } from "./api/approvalInbox.js";
import { auditLogsRouter } from "./api/auditLogs.js";
import authRouter from "./api/auth.js";
import billingRouter from "./api/billing/index.js";
import { createCheckpointRouter } from "./api/checkpoints.js";
import complianceRouter from "./api/compliance.js";
import { complianceEvidenceRouter } from "./api/complianceEvidence.js";
import crmRouter from "./api/crm.js";
import dsrRouter from "./api/dataSubjectRequests.js";
import documentRouter from "./api/documents.js";
import domainPacksRouter from "./api/domain-packs/index.js";
import {
  opportunityValueGraphRouter,
  valueGraphRouter,
} from "./api/valueGraph.js";
import groundtruthRouter from "./api/groundtruth.js";
import healthRouter, { markAsShuttingDown } from "./api/health/index.js";
import initiativesRouter from "./api/initiatives/index.js";
import integrationsRouter from "./api/integrations.js";
import mcpIntegrationsRouter from "./api/mcp-integrations.js";
import llmRouter from "./api/llm.js";
import {
  mcpDiscoveryRouter,
  serveMcpCapabilitiesDocument,
} from "./api/mcpDiscovery.js";
import onboardingRouter from "./api/onboarding.js";
import { projectsRouter } from "./api/projects.js";
import referralsRouter from "./api/referrals.js";
import securityMonitoringRouter from "./api/securityMonitoring.js";
import { secretAuditRouter } from "./api/secretAudit.js";
import teamsRouter from "./api/teams.js";
import { tenantContextRouter } from "./api/tenantContext.js";
import { usageRouter } from "./api/usage.js";
import { valueCasesRouter } from "./api/valueCases/index.js";
import { integrityRouter } from "./api/integrity.js";
import { valueCommitmentsRouter } from "./api/valueCommitments/router.js";
import { reasoningTracesRouter } from "./api/reasoningTraces.js";
import { valueGraphRouter as valueGraphCaseRouter } from "./routes/value-graph.js";
import realizationRouter from './routes/realization.js';
import { valueDriversRouter } from "./api/valueDrivers/index.js";
import workflowRouter from "./api/workflow.js";
import experienceRouter from "./api/experience.js";
import experienceStreamRouter from "./api/experience-stream.js";
import {
  secretHealthMiddleware,
  validateSecretsOnStartup,
} from "./config/secrets/SecretValidator.js";
import {
  initializeSecretVolumeWatcher,
  secretVolumeWatcher,
} from "./config/secrets/SecretVolumeWatcher.js";
import { validateEnvOrThrow } from "./config/validateEnv.js";
import { academyTrpcMiddleware } from "./api/academy/middleware.js";
import { appTrpcMiddleware } from "./api/trpc/middleware.js";
import docsApiRouter from "./docs-api/index.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from "./lib/supabase.js";
import { supabase } from "./lib/supabase.js";
import { ApprovalWebhookService } from "./services/approvals/ApprovalWebhookService.js";
import { NotificationActionSigner } from "./services/approvals/NotificationActionSigner.js";
import { EntitlementsService } from "./services/billing/EntitlementsService.js";
import { initCrmWorkers } from "./workers/crmWorker.js";
import { initMcpIntegrationWorkers } from "./workers/mcpIntegrationWorker.js";
import { initResearchWorker } from "./workers/researchWorker.js";
import { createArtifactGenerationWorker } from "./workers/ArtifactGenerationWorker.js";
import { createVersionedApiRouter } from "./versioning.js";
import {
  assertDevRoutesConfiguration,
  registerDevRoutes,
} from "./routes/devRoutes.js";
import { getAgentPolicyService } from "./services/policy/AgentPolicyService.js";
import {
  getBroadcastAdapter,
  initBroadcastAdapter,
} from "./services/realtime/WebSocketBroadcastAdapter.js";
import { getRecommendationEngine } from "./runtime/recommendation-engine/index.js";

// Conditionally import telemetry modules
let tracingMiddleware = null;
let latencyMetricsMiddleware = null;
let metricsMiddleware = null;
let getMetricsRegistry = null;
let getLatencySnapshot = null;
let telemetrySdk: { shutdown?: () => Promise<void> } | null = null;

if (process.env.ENABLE_TELEMETRY !== "false") {
  try {
    const telemetryModule = await import("./config/telemetry");
    tracingMiddleware = telemetryModule.tracingMiddleware;
    telemetrySdk = (await telemetryModule.initializeTelemetry()) as {
      shutdown?: () => Promise<void>;
    } | null;

    const latencyModule = await import("./middleware/latencyMetricsMiddleware");
    latencyMetricsMiddleware = latencyModule.latencyMetricsMiddleware;
    getLatencySnapshot = latencyModule.getLatencySnapshot;

    const metricsModule = await import("./middleware/metricsMiddleware");
    metricsMiddleware = metricsModule.metricsMiddleware;
    getMetricsRegistry = metricsModule.getMetricsRegistry;
  } catch (error) {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      logger.error(
        "Telemetry modules required in production but failed to initialize — aborting startup",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      process.exit(1);
    }
    logger.warn(
      "Telemetry modules not available, running without observability",
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

import {
  requireAuth,
  requireTenantRequestAlignment,
} from "./middleware/auth.js";
import { tenantContextMiddleware } from "./middleware/tenantContext.js";
import { tenantDbContextMiddleware } from "./middleware/tenantDbContext.js";
import { createBillingAccessEnforcement } from "./middleware/billingAccessEnforcement.js";
import { initSecrets, settings } from "./config/settings.js";
import { runtimeSecretStore } from "./config/secrets/RuntimeSecretStore.js";
import { securityAuditService } from "./services/post-v1/SecurityAuditService.js";
import { complianceControlCheckService } from "./services/security/ComplianceControlCheckService.js";
import { permissionService } from "./services/auth/PermissionService.js";
import { isConsentRegistryConfigured } from "./services/auth/consentRegistry.js";
import { TenantContextResolver } from "./services/tenant/TenantContextResolver.js";
import { logger } from "./lib/logger.js";
import { registerSupabaseInstrumentation } from "./lib/supabaseInstrumentation.js";
import {
  recordDroppedFrame,
  recordThrottledClient,
} from "./metrics/websocketSecurityMetrics.js";
import { cachingMiddleware } from "./middleware/cachingMiddleware.js";
import { createConcurrencyBackpressure } from "./middleware/concurrencyBackpressure.js";
import {
  accessLogMiddleware,
  globalErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  setupGlobalErrorHandlers,
} from "./middleware/globalErrorHandler.js";
import { createRateLimiter, rateLimiters } from "./middleware/rateLimiter.js";
import { requestAuditMiddleware } from "./middleware/requestAuditMiddleware.js";
import {
  cspNonceMiddleware,
  cspReportHandler,
  securityHeadersMiddleware,
} from "./middleware/securityHeaders.js";
import {
  csrfProtectionMiddleware,
  csrfTokenMiddleware,
} from "./middleware/securityMiddleware.js";
import {
  serviceIdentityMiddleware,
  validateServiceIdentityConfig,
} from "./middleware/serviceIdentityMiddleware.js";
import { logSecurityEvent } from "./security/enhancedSecurityLogger.js";
import { WebSocketLimiter } from "./services/realtime/WebSocketLimiter.js";
import {
  authenticateWebSocketRequest,
  getRequestedTenantId,
  getWebSocketToken,
  parseBearerToken,
} from "./server/websocket-request-auth.js";
import { registerServerMiddleware } from "./server/register-middleware.js";
import { mountServerRoutes } from "./server/register-routes.js";
import {
  validateAuditLogStartupConfig,
  validateInfrastructureConnectivity,
  validateProductionMfaStartup,
} from "./server/startupLifecycle.js";
const WS_POLICY_VIOLATION_CODE = 1008;
const WS_MAX_MESSAGES_PER_SECOND = Number(
  process.env.WS_MAX_MESSAGES_PER_SECOND ?? "30"
);
const WS_MAX_PAYLOAD_BYTES = Number(
  process.env.WS_MAX_PAYLOAD_BYTES ?? "65536"
);

getAgentPolicyService();
logger.info("[Instrumentation] Agent policy validation passed");

// Register Supabase query instrumentation (metrics + slow-query logs).
// Must run before any Supabase client is used.
registerSupabaseInstrumentation();
logger.info("[Instrumentation] Supabase query instrumentation registered");

EntitlementsService.setInstance(new EntitlementsService(supabase));
logger.info("[Instrumentation] EntitlementsService registered");

const app: Application = express();
// Trust only the first proxy hop (e.g. ALB/Caddy/Traefik).
// Using `true` trusts all X-Forwarded-* headers, allowing IP spoofing.
app.set("trust proxy", 1);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/sdui" });
const PORT = settings.API_PORT;
const apiRouter = createVersionedApiRouter();
const agentExecutionLimiter = createRateLimiter("strict", {
  message: "Too many agent calls. Please wait before trying again.",
  skip: req => req.method === "GET",
});

const billingAccessEnforcement = createBillingAccessEnforcement();
const agentsConcurrencyGuard = createConcurrencyBackpressure("/api/agents", {
  maxInFlight: 24,
  maxQueueDepth: 120,
  queueTimeoutMs: 12000,
  retryAfterSeconds: 2,
});
const groundtruthConcurrencyGuard = createConcurrencyBackpressure(
  "/api/groundtruth",
  {
    maxInFlight: 12,
    maxQueueDepth: 60,
    queueTimeoutMs: 10000,
    retryAfterSeconds: 2,
  }
);
const llmConcurrencyGuard = createConcurrencyBackpressure("/api/llm", {
  maxInFlight: 16,
  maxQueueDepth: 64,
  queueTimeoutMs: 8000,
  retryAfterSeconds: 1,
});
const onboardingConcurrencyGuard = createConcurrencyBackpressure(
  "/api/onboarding",
  {
    maxInFlight: 10,
    maxQueueDepth: 40,
    queueTimeoutMs: 15000,
    retryAfterSeconds: 3,
  }
);

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  tenantId: string;
  connectionId: string;
}

const websocketLimiter = new WebSocketLimiter({
  maxMessagesPerSecond: WS_MAX_MESSAGES_PER_SECOND,
  maxPayloadBytes: WS_MAX_PAYLOAD_BYTES,
});
let websocketConnectionCounter = 0;

const tenantResolver = new TenantContextResolver();

async function authenticateWebSocket(
  ws: WebSocket,
  req: IncomingMessage
): Promise<void> {
  const authResult = await authenticateWebSocketRequest(ws, req, {
    tenantResolver,
    logger,
  });
  if (!authResult) return;
  const { userId, tenantId } = authResult;
  const clientIp = req.socket.remoteAddress;

  const authedSocket = ws as AuthenticatedWebSocket;
  authedSocket.userId = userId;
  authedSocket.tenantId = tenantId;
  authedSocket.connectionId = `${tenantId}:${++websocketConnectionCounter}`;

  logger.info("WebSocket client connected", {
    clientIp,
    userId,
    tenantId,
    connectionId: authedSocket.connectionId,
  });

  ws.on("message", (data: RawData) => {
    const payloadBytes =
      typeof data === "string"
        ? Buffer.byteLength(data)
        : data instanceof ArrayBuffer
          ? data.byteLength
          : Array.isArray(data)
            ? data.reduce((total, segment) => total + segment.byteLength, 0)
            : data.byteLength;

    const limiterResult = websocketLimiter.evaluateMessage(
      authedSocket.connectionId,
      authedSocket.tenantId,
      payloadBytes
    );

    if (!limiterResult.allowed && limiterResult.reason) {
      recordDroppedFrame(limiterResult.reason);
      recordThrottledClient(authedSocket.tenantId);
      logSecurityEvent({
        type: "WEBSOCKET_FRAME_BLOCKED",
        category: "rate_limiting",
        severity: "high",
        outcome: "blocked",
        reason: limiterResult.reason,
        userId: authedSocket.userId,
        tenantId: authedSocket.tenantId,
        ipAddress: clientIp,
        metadata: {
          connectionId: authedSocket.connectionId,
          payloadBytes,
          maxPayloadBytes: WS_MAX_PAYLOAD_BYTES,
          maxMessagesPerSecond: WS_MAX_MESSAGES_PER_SECOND,
        },
      });

      ws.close(WS_POLICY_VIOLATION_CODE, "Policy violation");
      return;
    }

    try {
      const textPayload =
        typeof data === "string"
          ? data
          : data instanceof ArrayBuffer
            ? Buffer.from(data).toString()
            : Array.isArray(data)
              ? Buffer.concat(data).toString()
              : data.toString();
      const message = JSON.parse(textPayload) as {
        type?: string;
        messageId?: string;
        payload?: unknown;
      };
      logger.debug("WebSocket message received", {
        type: message.type,
        messageId: message.messageId,
      });

      switch (message.type) {
        case "sdui_update": {
          const senderTenantId = authedSocket.tenantId;
          wss.clients.forEach(client => {
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
      logger.error(
        "Error handling WebSocket message",
        error instanceof Error ? error : undefined
      );
    }
  });

  ws.on("close", () => {
    websocketLimiter.releaseConnection(
      authedSocket.connectionId,
      authedSocket.tenantId
    );
    logger.info("WebSocket client disconnected", {
      clientIp,
      userId,
      tenantId,
      connectionId: authedSocket.connectionId,
    });
  });

  ws.on("error", error => {
    logger.error("WebSocket error", error instanceof Error ? error : undefined);
  });
}

// WebSocket connection handling
wss.on("connection", (ws: WebSocket, req) => {
  void authenticateWebSocket(ws, req);
});

// Middleware
registerServerMiddleware({
  app,
  corsOrigins: settings.security.corsOrigins,
  requestIdMiddleware,
  accessLogMiddleware,
  cspNonceMiddleware,
  securityHeadersMiddleware,
  cachingMiddleware,
  csrfTokenMiddleware,
  csrfProtectionMiddleware,
  tracingMiddleware,
  metricsMiddleware,
  latencyMetricsMiddleware,
  requestAuditMiddleware,
});

mountServerRoutes({
  app,
  apiRouter,
  healthRouter,
  serviceIdentityMiddleware,
  getMetricsRegistry,
  getLatencySnapshot,
  cspReportHandler,
  secretHealthMiddleware,
  serveMcpCapabilitiesDocument,
  rateLimiters,
  requireAuth,
  requireTenantRequestAlignment,
  tenantContextMiddleware,
  tenantDbContextMiddleware,
  billingAccessEnforcement,
  agentExecutionLimiter,
  agentsConcurrencyGuard,
  groundtruthConcurrencyGuard,
  llmConcurrencyGuard,
  onboardingConcurrencyGuard,
  appTrpcMiddleware,
  academyTrpcMiddleware,
  createCheckpointRouter,
  createApprovalWebhookRouter,
  createServerSupabaseClient,
  ApprovalWebhookService,
  NotificationActionSigner,
  logger,
  authRouter,
  adminRouter,
  agentAdminRouter,
  securityMonitoringRouter,
  complianceRouter,
  agentsRouter,
  groundtruthRouter,
  llmRouter,
  mcpDiscoveryRouter,
  workflowRouter,
  experienceRouter,
  experienceStreamRouter,
  documentRouter,
  docsApiRouter,
  artifactsRouter,
  referralsRouter,
  usageRouter,
  analyticsRouter,
  dsrRouter,
  teamsRouter,
  integrationsRouter,
  mcpIntegrationsRouter,
  crmRouter,
  valueDriversRouter,
  onboardingRouter,
  domainPacksRouter,
  valueGraphRouter,
  auditLogsRouter,
  valueCasesRouter,
  integrityRouter,
  valueGraphCaseRouter,
  realizationRouter,
  reasoningTracesRouter,
  valueCommitmentsRouter,
  opportunityValueGraphRouter,
  tenantContextRouter,
  tenantContextRouterV1: tenantContextRouter,
  secretAuditRouter,
  complianceEvidenceRouter,
  approvalInboxRouter,
  billingRouter,
  projectsRouter,
  initiativesRouter,
});

await registerDevRoutes(app);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

async function startServer(): Promise<void> {
  logger.info("[Instrumentation] Starting backend server initialization");

  assertDevRoutesConfiguration();

  // 0. Setup global error handlers for unhandled rejections/exceptions
  logger.info("[Instrumentation] Setting up global error handlers");
  setupGlobalErrorHandlers();

  // 0.5. Hydrate managed secrets before any service initialization.
  // This closes the race where the server could start before Vault/AWS secrets are loaded.
  logger.info("[Instrumentation] Initializing runtime secret store");
  runtimeSecretStore.seedFromEnvironment();
  runtimeSecretStore.enforceProductionNoSecretEnvPolicy();
  await initSecrets();

  // 1. Validate all secrets before starting any services (production only)
  if (settings.NODE_ENV === "production") {
    logger.info("🔒 Validating secrets before server startup");
    await validateSecretsOnStartup();
    logger.info("✅ Secret validation completed successfully");
  }

  // 2. Validate production requirements
  logger.info("[Instrumentation] Validating production requirements");
  validateServiceIdentityConfig();
  validateAuditLogStartupConfig();
  validateProductionMfaStartup(settings, logger);
  if (settings.NODE_ENV === "production" && !isConsentRegistryConfigured()) {
    throw new Error(
      "Consent registry is not configured. Verify consent registry Supabase URL and authentication configuration."
    );
  }

  // 2.5. Validate required infrastructure connectivity (production only).
  // Fail fast before accepting traffic so that misconfigured pods are
  // immediately visible rather than silently degrading.
  if (settings.NODE_ENV === "production") {
    await validateInfrastructureConnectivity(logger);
  }

  // 3. Initialize infrastructure
  logger.info("[Instrumentation] Initializing infrastructure");
  await initializeContext();
  await initializeSecretVolumeWatcher();

  if (secretVolumeWatcher) {
    secretVolumeWatcher.on("reload-required", event => {
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

  // 3.5. Initialise Redis-backed WebSocket broadcast adapter so that
  // broadcasts reach clients on every backend pod, not just the local one.
  const broadcastAdapter = initBroadcastAdapter(wss);
  await broadcastAdapter.init();

  // 3.6. Start the RecommendationEngine — subscribes to domain events and
  // pushes next-best-action recommendations to connected UI clients.
  getRecommendationEngine().start();
  logger.info("[Instrumentation] RecommendationEngine started");

  // 4. Workers run as a separate process (see workers/workerMain.ts).
  // In development, optionally start them in-process for convenience.
  if (settings.NODE_ENV === "development") {
    try {
      initResearchWorker();
      logger.info(
        "[Instrumentation] Research worker initialized (in-process, dev only)"
      );
    } catch (workerErr) {
      logger.warn("[Instrumentation] Research worker failed to start:", {
        error: workerErr,
      });
    }

    try {
      initCrmWorkers();
      logger.info(
        "[Instrumentation] CRM workers initialized (in-process, dev only)"
      );
    } catch (workerErr) {
      logger.warn("[Instrumentation] CRM workers failed to start:", {
        error: workerErr,
      });
    }

    try {
      initMcpIntegrationWorkers();
      logger.info(
        "[Instrumentation] MCP integration workers initialized (in-process, dev only)"
      );
    } catch (workerErr) {
      logger.warn(
        "[Instrumentation] MCP integration workers failed to start:",
        { error: workerErr }
      );
    }

    try {
      createArtifactGenerationWorker();
      logger.info(
        "[Instrumentation] Artifact generation worker initialized (in-process, dev only)"
      );
    } catch (workerErr) {
      logger.warn(
        "[Instrumentation] Artifact generation worker failed to start:",
        { error: workerErr }
      );
    }
  } else {
    logger.info(
      "[Instrumentation] Workers run as separate process; skipping in-process init"
    );
  }

  server.listen(PORT, () => {
    logger.info(`[Instrumentation] Server listening on port ${PORT}`);
    logger.info(
      `Billing API server with WebSocket support running on port ${PORT}`,
      {
        url: `http://localhost:${PORT}`,
        webSocketUrl: `ws://localhost:${PORT}/ws/sdui`,
        healthCheck: `http://localhost:${PORT}/health`,
      }
    );
  });

  // 6. Start audit log DLQ retry loop
  securityAuditService.startRetryLoop();

  // 7. Start compliance automated control check scheduler
  const shouldStartComplianceScheduler =
    settings.NODE_ENV === "development" ||
    process.env.COMPLIANCE_SCHEDULER_LEADER === "true";

  if (shouldStartComplianceScheduler) {
    logger.info(
      "[Instrumentation] Starting compliance automated control check scheduler on this instance"
    );
    complianceControlCheckService.start();
  } else {
    logger.info(
      "[Instrumentation] Skipping compliance automated control check scheduler; not leader instance"
    );
  }

  // 8. Register graceful shutdown handlers
  registerGracefulShutdown();
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

const SHUTDOWN_TIMEOUT_MS = 15_000;
let isShuttingDown = false;

function registerGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown`);

    // 1. Tell health check to return 503 so the load balancer stops sending traffic
    markAsShuttingDown();

    // 2. Stop audit DLQ retry loop
    securityAuditService.stopRetryLoop();

    // 2.5. Stop RecommendationEngine subscriptions
    getRecommendationEngine().stop();

    // 2.6 Stop compliance control check scheduler
    complianceControlCheckService.stop();

    // 2.6. Tear down RBAC invalidation Redis pub/sub subscription
    permissionService.destroy().catch(() => {});

    // 3. Tear down Redis pub/sub for WebSocket broadcasts
    getBroadcastAdapter()
      .shutdown()
      .catch(() => {});

    // 3.5 Flush OpenTelemetry buffers
    telemetrySdk?.shutdown?.().catch(error => {
      logger.warn("OpenTelemetry shutdown failed", {
        event: "telemetry.shutdown",
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // 4. Close WebSocket connections
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, "Server shutting down");
      }
    });

    // 5. Stop accepting new HTTP connections and drain existing ones
    server.close(() => {
      logger.info("All connections drained, exiting");
      process.exit(0);
    });

    // 4. Force exit if connections don't drain in time
    setTimeout(() => {
      logger.error(`Forcing exit after ${SHUTDOWN_TIMEOUT_MS}ms timeout`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

const isMainModule =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

// Start server when executed directly (or when running via tsx watch in development)
if (isMainModule || settings.NODE_ENV === "development") {
  void startServer();
}

// ============================================================================
// Agent Reasoning Broadcast Helper
// ============================================================================

/**
 * Broadcast a reasoning chain update to all authenticated WebSocket clients
 * in the specified tenant across all pods. Uses Redis pub/sub when available,
 * falls back to local-only delivery.
 */
function broadcastReasoningUpdate(tenantId: string, chain: unknown): void {
  const message = JSON.stringify({
    type: "agent.event",
    payload: {
      eventType: "agent.reasoning.update",
      data: chain,
    },
  });

  try {
    getBroadcastAdapter().broadcast(tenantId, message);
  } catch {
    // Adapter not yet initialised (e.g. during tests) — fall back to local.
    wss.clients.forEach(client => {
      const authed = client as AuthenticatedWebSocket;
      if (
        authed.tenantId === tenantId &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(message);
      }
    });
  }
}

export {
  app,
  server,
  wss,
  broadcastReasoningUpdate,
  parseBearerToken,
  getWebSocketToken,
  getRequestedTenantId,
};
export default app;
