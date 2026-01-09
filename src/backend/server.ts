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
import workflowRouter from "../api/workflow";
import documentRouter from "../api/documents";
import healthRouter from "../api/health";
import authRouter from "../api/auth";
import docsApiRouter from "./docs-api";
import { createLogger } from "../lib/logger";
import { createVersionedApiRouter } from "./versioning";
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
import { securityHeadersMiddleware } from "../middleware/securityHeaders";
import { extractTenantId, requireAuth, verifyAccessToken } from "../middleware/auth";
import { settings } from "../config/settings";
import { isConsentRegistryConfigured } from "../services/consentRegistry";
import { TenantContextResolver } from "../services/TenantContextResolver";

const logger = createLogger({ component: "BillingServer" });
const INTERNAL_ERROR_STATUS = 500;

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
const tenantContextResolver = new TenantContextResolver();
const WS_UNAUTHORIZED_CODE = 1008;
const SUPABASE_TOKEN_PREFIX = "Bearer ";

type AuthenticatedWebSocket = WebSocket & {
  tenantId?: string;
  userId?: string;
};

function parseWebSocketToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith(SUPABASE_TOKEN_PREFIX)) {
    const token = authHeader.slice(SUPABASE_TOKEN_PREFIX.length).trim();
    if (token) {
      return token;
    }
  }

  const url = new URL(req.url ?? "", "http://localhost");
  return (
    url.searchParams.get("token") ??
    url.searchParams.get("access_token") ??
    null
  );
}

function parseWebSocketTenantHint(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? "", "http://localhost");
  return url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id");
}

async function authenticateWebSocket(
  ws: AuthenticatedWebSocket,
  req: IncomingMessage
): Promise<boolean> {
  const token = parseWebSocketToken(req);
  if (!token) {
    ws.close(WS_UNAUTHORIZED_CODE, "Authentication required");
    return false;
  }

  const verified = await verifyAccessToken(token);
  if (!verified?.user) {
    ws.close(WS_UNAUTHORIZED_CODE, "Invalid or expired token");
    return false;
  }

  const claims = verified.claims ?? null;
  let tenantId = extractTenantId(claims, verified.user);

  if (!tenantId) {
    const requestedTenantId = parseWebSocketTenantHint(req);
    if (requestedTenantId && verified.user.id) {
      const hasAccess = await tenantContextResolver.hasTenantAccess(
        verified.user.id,
        requestedTenantId
      );
      if (hasAccess) {
        tenantId = requestedTenantId;
      }
    }
  }

  if (!tenantId) {
    ws.close(WS_UNAUTHORIZED_CODE, "Tenant access required");
    return false;
  }

  ws.tenantId = tenantId;
  ws.userId = verified.user.id;
  return true;
}

// WebSocket connection handling
wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  const isAuthenticated = await authenticateWebSocket(ws, req);
  if (!isAuthenticated) {
    logger.warn("WebSocket authentication failed", { clientIp });
    return;
  }

  logger.info("WebSocket client connected", {
    clientIp,
    tenantId: ws.tenantId,
    userId: ws.userId,
  });

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      logger.debug("WebSocket message received", {
        type: message.type,
        messageId: message.messageId,
      });

      switch (message.type) {
        case "sdui_update":
          wss.clients.forEach((client) => {
            const target = client as AuthenticatedWebSocket;
            if (
              client !== ws &&
              client.readyState === WebSocket.OPEN &&
              target.tenantId === ws.tenantId
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
    logger.info("WebSocket client disconnected", { clientIp });
  });

  ws.on("error", (error) => {
    logger.error("WebSocket error", error instanceof Error ? error : undefined);
  });
});

// Middleware
app.use(
  cors({
    origin: settings.security.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.raw({ type: "application/json" }));
app.use(securityHeadersMiddleware);
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

// Mount routes
apiRouter.use("/billing", billingRouter);
app.use("/api", apiRouter);
app.use("/api/auth", authRouter);
app.use("/api/agents", agentExecutionLimiter, agentsRouter);
app.use("/api", workflowRouter);
app.use("/api/documents", requireAuth, documentRouter);
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
