import express, { Router } from "express";
import { createLogger } from "@shared/lib/logger";

const logger = createLogger("analytics-api");
const analyticsRouter: Router = express.Router();

/**
 * Web Vitals analytics endpoint
 * Accepts Core Web Vitals metrics from the frontend
 */
analyticsRouter.post("/web-vitals", express.json(), async (req, res) => {
  try {
    const { name, value, rating, delta, entries, userAgent, url, timestamp } = req.body;

    // Validate required fields
    if (!name || typeof value !== "number") {
      return res.status(400).json({
        error: "Invalid payload",
        required: ["name", "value"],
      });
    }

    // Log the metric for analysis
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

    // In production, you might want to:
    // 1. Store in database for historical analysis
    // 2. Send to monitoring service (DataDog, New Relic, etc.)
    // 3. Aggregate metrics for alerting

    // Example: Store in database (placeholder)
    // await supabase.from('web_vitals').insert({
    //   name,
    //   value,
    //   rating,
    //   url,
    //   user_agent: userAgent,
    //   timestamp: new Date(timestamp),
    //   organization_id: req.organizationId, // from tenant context
    // });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Failed to process web vitals", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Performance metrics endpoint
 * Accepts general performance metrics
 */
analyticsRouter.post("/performance", express.json(), async (req, res) => {
  try {
    const { type, data, timestamp } = req.body;

    logger.info("Performance metric recorded", {
      type,
      data,
      timestamp: timestamp || new Date().toISOString(),
      ip: req.ip,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Failed to process performance metric", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default analyticsRouter;
