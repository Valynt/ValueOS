/**
 * Base Express server for ValueOS agents
 * Provides common middleware, health checks, and metrics endpoints
 */

import express from "express";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { getMetricsRegistry } from "./metrics.js";
import { healthMiddleware, HealthChecker, defaultHealthChecks } from "./health.js";
import { SafetyGuard } from "./safety.js";

export interface ServerOptions {
  agentType: string;
  version?: string;
  customHealthChecks?: Array<{ name: string; check: () => any; critical?: boolean }>;
  middleware?: express.RequestHandler[];
}

/**
 * Create and configure Express server for agent
 */
export function createServer(options: ServerOptions): express.Application {
  const app = express();
  const config = getConfig();

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Safety Middleware
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT") {
      const guard = new SafetyGuard();
      if (req.body && typeof req.body === "object") {
        const bodyStr = JSON.stringify(req.body);
        const result = guard.validateInput(bodyStr, options.agentType);
        if (!result.valid) {
          logger.warn("Safety check failed", {
            reason: result.reason,
            ip: req.ip,
            agentType: options.agentType,
          });
          res.status(400).json({ error: "Safety check failed", details: result.reason });
          return;
        }
      }
    }
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
      });
    });
    next();
  });

  // Custom middleware
  if (options.middleware) {
    options.middleware.forEach((mw) => app.use(mw));
  }

  // Health checker
  const healthChecker = new HealthChecker();
  healthChecker.addCheck({
    name: "liveness",
    check: defaultHealthChecks.liveness,
    critical: true,
  });
  healthChecker.addCheck({
    name: "memory",
    check: defaultHealthChecks.memory,
  });

  // Add custom health checks
  if (options.customHealthChecks) {
    options.customHealthChecks.forEach((check) => {
      healthChecker.addCheck(check);
    });
  }

  // Routes
  app.get("/health", healthMiddleware(healthChecker, options.version));

  app.get("/metrics", async (req, res) => {
    try {
      const registry = getMetricsRegistry();
      const metrics = await registry.metrics();
      res.set("Content-Type", registry.contentType);
      res.send(metrics);
    } catch (error) {
      logger.error("Failed to generate metrics", error);
      res.status(500).send("Error generating metrics");
    }
  });

  // Agent info endpoint
  app.get("/info", (req, res) => {
    res.json({
      agentType: options.agentType,
      version: options.version || "1.0.0",
      environment: config.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Error handling
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error("Unhandled error", err, {
      url: req.url,
      method: req.method,
      ip: req.ip,
    });
    res.status(500).json({
      error: "Internal server error",
      ...(config.NODE_ENV === "development" && { details: err.message }),
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

/**
 * Start the server
 */
export function startServer(app: express.Application, port?: number): Promise<void> {
  const config = getConfig();
  const serverPort = port || config.PORT;

  return new Promise((resolve) => {
    app.listen(serverPort, config.HOST, () => {
      logger.info(`Agent server started`, {
        port: serverPort,
        host: config.HOST,
        agentType: config.AGENT_TYPE,
        environment: config.NODE_ENV,
      });
      resolve();
    });
  });
}
