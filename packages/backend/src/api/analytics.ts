import { createLogger } from "@shared/lib/logger";
import express, { Router } from "express";

import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { tenantContextMiddleware } from "../middleware/tenantContext.js";
import { getTenantIdFromRequest, ReadThroughCacheService } from "../services/ReadThroughCacheService.js";
import {
  ValueLoopAnalytics,
  RecordEventInputSchema,
} from "../analytics/ValueLoopAnalytics.js";

const logger = createLogger({ component: "analytics-api" });
const analyticsRouter: Router = express.Router();

const analyticsLimiter = createRateLimiter("standard", {
  message: "Too many analytics requests. Please slow down.",
});

analyticsRouter.use(optionalAuth);
analyticsRouter.use(analyticsLimiter);

analyticsRouter.get("/summary", async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req as any) ?? "anonymous";
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
    if (tenantId) {
      await ReadThroughCacheService.invalidateEndpoint(tenantId, "api-analytics-summary");
    }

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
    if (tenantId) {
      await ReadThroughCacheService.invalidateEndpoint(tenantId, "api-analytics-summary");
    }

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to process performance metric", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

// ─── Value loop analytics ─────────────────────────────────────────────────────

// POST /api/analytics/value-loop/events — record a single value loop event
analyticsRouter.post(
  "/value-loop/events",
  requireAuth,
  tenantContextMiddleware(),
  express.json(),
  async (req, res) => {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }
    const parsed = RecordEventInputSchema.safeParse({
      ...req.body,
      organizationId: tenantId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid event payload", details: parsed.error.flatten() });
    }

    await ValueLoopAnalytics.record(parsed.data);
    return res.status(201).json({ success: true });
  },
);

// GET /api/analytics/value-loop/insights — aggregated insights for the tenant
analyticsRouter.get(
  "/value-loop/insights",
  requireAuth,
  tenantContextMiddleware(),
  async (req, res) => {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }
    const windowDays = Math.min(Number(req.query.days ?? 30), 90);

    const insights = await ValueLoopAnalytics.getInsights(tenantId, windowDays);
    return res.status(200).json({ success: true, data: insights });
  },
);

export default analyticsRouter;
