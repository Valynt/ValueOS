/**
 * Backend Server for Billing API
 * Minimal Express server for secure billing operations
 */

import express from "express";
import cors from "cors";
import { createServer, type IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import billingRouter from "../api/billing";
import agentsRouter from "../api/agents";
import canvasRouter from "../api/canvas";
import groundtruthRouter from "../api/groundtruth";
import llmRouter from "../api/llm";
import workflowRouter from "../api/workflow";
import documentRouter from "../api/documents";
import healthRouter, { markAsShuttingDown } from "../api/health";
import authRouter from "../api/auth";
import adminRouter from "../api/admin";
import projectsRouter from "../api/projects";
import customerRouter from "../api/customer";
import docsApiRouter from "./docs-api";
import {
  initializeSecretVolumeWatcher,
  secretVolumeWatcher,
} from "../config/secrets/SecretVolumeWatcher";
import { Logger } from "../utils/logger";
import { createVersionedApiRouter } from "./versioning";
import { initializeContext } from "../lib/context";
import { tracingMiddleware } from "../config/telemetry";
import { requestAuditMiddleware } from "../middleware/requestAuditMiddleware";
import {
  getLatencySnapshot,
  latencyMetricsMiddleware,
} from "../middleware/latencyMetricsMiddleware";
import { getMetricsRegistry, metricsMiddleware } from "../middleware/metricsMiddleware";
import { createRateLimiter } from "../middleware/rateLimiter";
import { serviceIdentityMiddleware } from "../middleware/serviceIdentityMiddleware";
import { securityHeadersMiddleware, cspReportHandler } from "../middleware/securityHeaders";
import { sessionTimeoutMiddleware } from "../middleware/sessionTimeoutMiddleware";
import { extractTenantId, requireAuth, verifyAccessToken } from "../middleware/auth";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { settings } from "../config/settings";
import { isConsentRegistryConfigured } from "../services/consentRegistry";
import { TenantContextResolver } from "../services/TenantContextResolver";
import { errorHandler } from "../middleware/errorHandler";
import { llmQueue } from "../services/MessageQueue";
import { agentOrchestrator } from "../services/AgentOrchestratorAdapter";
import { getAgentMessageBroker } from "../services/AgentMessageBroker";
import {
  configureGracefulShutdown,
  initiateGracefulShutdown,
  registerShutdownHandler,
  wireProcessShutdownSignals,
} from "../lib/shutdown/gracefulShutdown";

const logger = new Logger({ component: "BillingServer" });
const INTERNAL_ERROR_STATUS = 500;
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

  // Sprint 1: Reject query-string tokens in production (security hardening)
  if (settings.NODE_ENV === "production") {
    logger.warn("WebSocket authentication: query-string tokens rejected in production", {
      clientIp: req.socket.remoteAddress,
    });
    return null;
  }

  const url = new URL(req.url ?? "", "http://localhost");
  return url.searchParams.get("access_token") ?? url.searchParams.get("token");
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
    logger.warn("WebSocket authentication failed: missing user id", { clientIp });
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
    logger.warn("WebSocket authentication failed: missing tenant context", { clientIp, userId });
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
    logger.info("WebSocket client disconnected", { clientIp, userId, tenantId });
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
app.use(
  cors({
    origin: settings.security.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(securityHeadersMiddleware);
app.use(tracingMiddleware()); // Add tracing middleware early
app.use(metricsMiddleware());
app.use(requestAuditMiddleware());
app.use(latencyMetricsMiddleware());
app.use("/api", sessionTimeoutMiddleware);

// Health check
app.use(healthRouter);

// Prometheus metrics endpoint - PROTECTED (Sprint 1: P0 fix)
app.get(
  "/metrics",
  serviceIdentityMiddleware,
  async (_req: express.Request, res: express.Response) => {
    const registry = getMetricsRegistry();
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  }
);

// Latency metrics snapshot - PROTECTED (Sprint 1: P0 fix)
app.get("/metrics/latency", serviceIdentityMiddleware, (_req, res) => {
  res.json({
    routes: getLatencySnapshot(),
    timestamp: new Date().toISOString(),
  });
});

// CSP Reporting Endpoint
app.post("/api/csp-report", express.json({ type: "application/csp-report" }), cspReportHandler);

// Mount routes
apiRouter.use("/billing", billingRouter);
app.use("/api", apiRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use(
  "/api/agents",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  agentExecutionLimiter,
  agentsRouter
);
app.use(
  "/api/groundtruth",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  agentExecutionLimiter,
  groundtruthRouter
);
app.use(
  "/api/canvas",
  serviceIdentityMiddleware,
  requireAuth,
  tenantContextMiddleware(),
  canvasRouter
);
app.use("/api/llm", llmRouter);
app.use("/api", workflowRouter);
app.use("/api/documents", requireAuth, tenantContextMiddleware(), documentRouter);
app.use("/api/docs", docsApiRouter);
app.use("/api/customer", customerRouter);
app.use(
  "/api/workspaces/:tenantId/projects",
  requireAuth,
  tenantContextMiddleware(),
  projectsRouter
);

// Error handler
app.use(errorHandler);

function configureShutdownLogging(): void {
  configureGracefulShutdown({
    timeoutMs: settings.SHUTDOWN_TIMEOUT_MS,
    log: (level, message, meta) => {
      if (level === "error") {
        logger.error(message, undefined, meta);
      } else if (level === "warn") {
        logger.warn(message, meta);
      } else {
        logger.info(message, meta);
      }
    },
  });
}

export function registerServerShutdownHandlers(): void {
  // 1) Advertise shutdown first so health checks and load balancers stop routing traffic.
  registerShutdownHandler("markAsShuttingDown", async () => {
    markAsShuttingDown();
  });

  // 2) Then stop accepting new network work (HTTP/WebSocket) to cap in-flight growth.
  registerShutdownHandler("closeNetworkServers", async () => {
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  // 3) Finally, drain existing in-flight queues to preserve work already accepted.
  registerShutdownHandler("drainInflightExecutions", async () => {
    await Promise.all([
      agentOrchestrator.awaitDrain(),
      getAgentMessageBroker().shutdown(),
      llmQueue.shutdown(),
    ]);
  });
}

configureShutdownLogging();
registerServerShutdownHandlers();
wireProcessShutdownSignals(["SIGTERM", "SIGINT"]);

export function requestShutdownForSecretReload(secretKey: string): void {
  void initiateGracefulShutdown(`secret-reload:${secretKey}`);
}

async function startServer(): Promise<void> {
  if (settings.NODE_ENV === "production" && !isConsentRegistryConfigured()) {
    throw new Error(
      "Consent registry is not configured. Verify consent registry Supabase URL and authentication configuration."
    );
  }

  // Initialize infrastructure
  await initializeContext();
  await initializeSecretVolumeWatcher();

  if (secretVolumeWatcher) {
    secretVolumeWatcher.on("reload-required", (event) => {
      logger.warn("Graceful shutdown initiated due to secret change", {
        secretKey: event.secretKey,
      });

      requestShutdownForSecretReload(event.secretKey);
    });
  }

  server.listen(PORT, () => {
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

export { app, server, wss };
export default app;
