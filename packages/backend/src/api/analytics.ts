import { createLogger } from "@shared/lib/logger";
import express, { Router } from "express";

import { optionalAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import {
  getTenantIdFromRequest,
  ReadThroughCacheService,
} from "../services/ReadThroughCacheService.js";

const logger = createLogger("analytics-api");
const analyticsRouter: Router = express.Router();

const analyticsLimiter = createRateLimiter("standard", {
  message: "Too many analytics requests. Please slow down.",
});

analyticsRouter.use(optionalAuth);
analyticsRouter.use(analyticsLimiter);

analyticsRouter.get("/summary", async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req as any);
    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-analytics-summary",
        scope: "summary",
        tier: "warm",
        keyPayload: req.query,
      },
      async () => ({
        success: true,
        data: {
          period: (req.query.period as string) || "24h",
          generatedAt: new Date().toISOString(),
          webVitalsEvents: 0,
          performanceEvents: 0,
        },
      })
    );

    res.status(200).json(payload);
    return;
  } catch (error) {
    logger.error("Failed to load analytics summary", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

analyticsRouter.post("/web-vitals", express.json(), async (req, res) => {
  try {
    const { name, value, rating, delta, userAgent, url, timestamp } = req.body;

    if (!name || typeof value !== "number") {
      return res.status(400).json({
        error: "Invalid payload",
        required: ["name", "value"],
      });
    }

    logger.info("Web Vital recorded", {
      name,
      value: Math.round(value),
      rating,
      delta,
      url: url || req.headers.referer,
      userAgent: userAgent || req.headers["user-agent"],
      timestamp: timestamp || new Date().toISOString(),
      ip: req.ip,
    });

    const tenantId = getTenantIdFromRequest(req as any);
    await ReadThroughCacheService.invalidateEndpoint(tenantId, "api-analytics-summary");

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to process web vitals", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

analyticsRouter.post("/performance", express.json(), async (req, res) => {
  try {
    const { type, data, timestamp } = req.body;

    logger.info("Performance metric recorded", {
      type,
      data,
      timestamp: timestamp || new Date().toISOString(),
      ip: req.ip,
    });

    const tenantId = getTenantIdFromRequest(req as any);
    await ReadThroughCacheService.invalidateEndpoint(tenantId, "api-analytics-summary");

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to process performance metric", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

export default analyticsRouter;
