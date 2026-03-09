import { createLogger } from "@shared/lib/logger";
import { getRequestSupabaseClient } from "@shared/lib/supabase";
import express, { Router } from "express";

import { optionalAuth, requireAuth } from "../middleware/auth.js";
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

analyticsRouter.post("/value-loop/events", requireAuth, express.json(), async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req as any);
    const { stage, eventType, durationMs, metadata } = req.body;

    if (!stage || !eventType) {
      return res.status(400).json({ error: "Invalid payload", required: ["stage", "eventType"] });
    }

    const supabase = getRequestSupabaseClient(req as any);
    await supabase.from("value_loop_events").insert({
      organization_id: tenantId,
      stage,
      event_type: eventType,
      duration_ms: durationMs ?? null,
      metadata: metadata ?? null,
      recorded_at: new Date().toISOString(),
    });

    await ReadThroughCacheService.invalidateEndpoint(tenantId, "api-analytics-value-loop");

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    logger.error("Failed to record value-loop event", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

analyticsRouter.get("/value-loop/insights", requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantIdFromRequest(req as any);

    const payload = await ReadThroughCacheService.getOrLoad(
      {
        tenantId,
        endpoint: "api-analytics-value-loop",
        scope: "insights",
        tier: "warm",
        keyPayload: req.query,
      },
      async () => {
        // getInsights queries Supabase — will throw if env vars are absent,
        // which is caught by the outer try/catch and returned as a 500.
        const supabase = getRequestSupabaseClient(req as any);
        const { data, error } = await supabase
          .from("value_loop_events")
          .select("stage, event_type, duration_ms, recorded_at")
          .eq("organization_id", tenantId)
          .order("recorded_at", { ascending: false })
          .limit(500);

        if (error) throw error;

        return {
          success: true,
          data: {
            generatedAt: new Date().toISOString(),
            events: data ?? [],
          },
        };
      }
    );

    res.status(200).json(payload);
    return;
  } catch (error) {
    logger.error("Failed to load value-loop insights", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
});

export default analyticsRouter;
