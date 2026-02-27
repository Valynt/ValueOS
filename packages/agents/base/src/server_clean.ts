/**
 * Clean server implementation for ValueOS agents
 * Simplified version with proper health checks
 */

import express from "express";
import { defaultHealthChecks, HealthChecker } from "./health.js";
import { getMetricsRegistry } from "./metrics.js";
import { logger } from "./logger.js";

interface ServerOptions {
  port?: number;
  customHealthChecks?: Record<string, () => any>;
}

export class AgentServer {
  private app: express.Application;
  private healthChecker: HealthChecker;

  constructor(options: ServerOptions = {}) {
    this.app = express();
    this.healthChecker = new HealthChecker();

    this.setupMiddleware();
    this.setupHealthChecks(options.customHealthChecks);
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    // Add other middleware as needed
  }

  private setupHealthChecks(customHealthChecks?: Record<string, () => any>) {
    // Add default health checks
    this.healthChecker.addCheck({
      name: "liveness",
      check: defaultHealthChecks.liveness,
      critical: true,
    });
    this.healthChecker.addCheck({
      name: "memory",
      check: defaultHealthChecks.memory,
    });

    // Add custom health checks
    if (customHealthChecks) {
      for (const [name, checkFn] of Object.entries(customHealthChecks)) {
        this.healthChecker.addCheck({
          name,
          check: checkFn,
        });
      }
    }
  }

  private setupRoutes() {
    // Health endpoint
    this.app.get("/health", async (req, res) => {
      try {
        const status = await this.healthChecker.getHealthStatus();
        res.status(status.status === "healthy" ? 200 : 503).json(status);
      } catch (error) {
        logger.error("Health check failed", error);
        res.status(503).json({ status: "unhealthy", error: "Health check failed" });
      }
    });

    // Metrics endpoint
    this.app.get("/metrics", async (req, res) => {
      try {
        const registry = getMetricsRegistry();
        res.set("Content-Type", registry.contentType);
        res.end(await registry.metrics());
      } catch (error) {
        logger.error("Failed to generate metrics", error);
        res.status(500).end();
      }
    });

    // Add other routes as needed
  }

  public start(port: number = 3000) {
    this.app.listen(port, () => {
      logger.info(`Agent server listening on port ${port}`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}
