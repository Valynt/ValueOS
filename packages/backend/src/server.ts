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

console.log("[Environment] Configuration loaded for development (redacted)");

// Now safe to import modules that depend on env vars
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
import referralsRouter from "../api/referrals";
import projectsRouter from "../api/projects";
import docsApiRouter from "./docs-api";
import {
  initializeSecretVolumeWatcher,
  secretVolumeWatcher,
} from './config/secrets/SecretVolumeWatcher";
import {
  validateSecretsOnStartup,
  secretHealthMiddleware,
} from './config/secrets/SecretValidator";import { validateEnvOrThrow } from "./config/validateEnv";import { createLogger } from '@shared/lib/logger";
import { createVersionedApiRouter } from "./versioning";
import { initializeContext } from '@shared/lib/context";
import { tracingMiddleware } from './config/telemetry";
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
import {
  requestIdMiddleware,
  accessLogMiddleware,
  globalErrorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from "../middleware/globalErrorHandler";
import { serviceIdentityMiddleware } from "../middleware/serviceIdentityMiddleware";
import {
  securityHeadersMiddleware,
  cspReportHandler,
} from "../middleware/securityHeaders";
import {
  extractTenantId,
  requireAuth,
  verifyAccessToken,
} from "../middleware/auth";
import { tenantContextMiddleware } from "../middleware/tenantContext";
import { settings } from './config/settings";
import { isConsentRegistryConfigured } from './services/consentRegistry";
import { TenantContextResolver } from './services/TenantContextResolver";

const logger = createLogger({ component: "BillingServer" });
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

async function authenticateWebSocket(
  ws: WebSocket,
  req: IncomingMessage
): Promise<void> {
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
      const hasAccess = await tenantResolver.hasTenantAccess(
        userId,
        requestedTenantId
      );
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
      logger.error(
        "Error handling WebSocket message",
        error instanceof Error ? error : undefined
      );
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
app.use(
  cors({
    origin: settings.security.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(requestIdMiddleware); // Request ID and timing (must be early)
app.use(accessLogMiddleware); // Access logging
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
app.post(
  "/api/csp-report",
  express.json({ type: "application/csp-report" }),
  cspReportHandler
);

// Secret Health Check Endpoint
app.get("/health/secrets", secretHealthMiddleware());

// Mount routes
apiRouter.use("/billing", billingRouter);
apiRouter.use("/projects", projectsRouter);
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
app.use(
  "/api/documents",
  requireAuth,
  tenantContextMiddleware(),
  documentRouter
);
app.use("/api/docs", docsApiRouter);
app.use("/api/referrals", referralsRouter);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

async function startServer(): Promise<void> {
  // 0. Setup global error handlers for unhandled rejections/exceptions
  setupGlobalErrorHandlers();

  // 1. Validate all secrets before starting any services
  logger.info("🔒 Validating secrets before server startup");
  await validateSecretsOnStartup();
  logger.info("✅ Secret validation completed successfully");

  // 2. Validate production requirements
  if (settings.NODE_ENV === "production" && !isConsentRegistryConfigured()) {
    throw new Error(
      "Consent registry is not configured. Verify consent registry Supabase URL and authentication configuration."
    );
  }

  // 3. Initialize infrastructure
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

const isMainModule =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module;

// Start server when executed directly (or when running via tsx watch in development)
if (isMainModule || settings.NODE_ENV === "development") {
  void startServer();
}

export { app, server, wss };
export default app;
