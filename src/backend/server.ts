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
import groundtruthRouter from "../api/groundtruth";
import workflowRouter from "../api/workflow";
import documentRouter from "../api/documents";
import healthRouter, { markAsShuttingDown } from "../api/health";
import authRouter from "../api/auth";
import adminRouter from "../api/admin";
import docsApiRouter from "./docs-api";
import { initializeSecretVolumeWatcher, secretVolumeWatcher } from "../config/secrets/SecretVolumeWatcher";
import { createLogger } from "../lib/logger";
import { createVersionedApiRouter } from "./versioning";
import { initializeContext } from "../lib/context";
import { tracingMiddleware } from "../config/telemetry";
import { requestAuditMiddleware } from "../middleware/requestAuditMiddleware";
import {
  getLatencySnapshot,
  latencyMetricsMiddleware,
} from "../middleware/latencyMetricsMiddleware";
import {
  getMetricsRegistry,
  metricsMiddleware,
} from "../middleware/metricsMiddleware";
import { createRateLimiter } from "../middleware/rateLimiter";
import { serviceIdentityMiddleware } from "../middleware/serviceIdentityMiddleware";
import { securityHeadersMiddleware, cspReportHandler } from "../middleware/securityHeaders";
import { extractTenantId, requireAuth, verifyAccessToken } from "../middleware/auth";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { settings } from "../config/settings";
import { isConsentRegistryConfigured } from "../services/consentRegistry";
import { TenantContextResolver } from "../services/TenantContextResolver";

const logger = createLogger({ component: "BillingServer" });
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
      logger.error(
        "Error handling WebSocket message",
        error instanceof Error ? error : undefined
      );
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

// Health check
app.use(healthRouter);

// Prometheus metrics endpoint
app.get("/metrics", async (_req: express.Request, res: express.Response) => {
  const registry = getMetricsRegistry();
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

// Latency metrics snapshot
app.get("/metrics/latency", (_req, res) => {
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
app.use("/api", workflowRouter);
app.use("/api/documents", requireAuth, tenantContextMiddleware(), documentRouter);
app.use("/api/docs", docsApiRouter);

// Error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ): void => {
    logger.error(
      "Server error",
      err instanceof Error ? err : new Error(String(err)),
      {
        requestId: res.locals.requestId,
      }
    );
    const message =
      settings.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : undefined;
    res.status(INTERNAL_ERROR_STATUS).json({
      error: "Internal server error",
      message,
    });
  }
);

// Start server
if (
  import.meta.url === `file://${process.argv[1]}` ||
  settings.NODE_ENV === "development"
) {
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

  server.listen(PORT, () => {
    logger.info(
      `Billing API server with WebSocket support running on port ${PORT}`,
      {
        url: `http://localhost:${PORT}`,
        webSocketUrl: `ws://localhost:${PORT}/ws/sdui`,
        healthCheck: `http://localhost:${PORT}/health`,
      }
    );
  });
}

export { app, server, wss };
export default app;
