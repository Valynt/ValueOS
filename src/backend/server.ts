/**
 * Backend Server for Billing API
 * Minimal Express server for secure billing operations
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import billingRouter from "../api/billing";
import agentsRouter from "../api/agents";
import workflowRouter from "../api/workflow";
import documentRouter from "../api/documents";
import healthRouter from "../api/health";
import authRouter from "../api/auth";
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
import { settings } from "../config/settings";

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

// WebSocket connection handling
wss.on("connection", (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  logger.info("WebSocket client connected", { clientIp });

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
            if (client !== ws && client.readyState === WebSocket.OPEN) {
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
app.use("/api/documents", documentRouter);

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

export default app;
