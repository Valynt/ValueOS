/**
 * Security Monitoring API
 * Provides endpoints for the security dashboard to retrieve security metrics, events, and persisted anomaly alerts.
 */

import { Request, Response, Router } from "express";
import { z } from "zod";

import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObservabilityAccess } from "../middleware/observabilityAccess.js";
import { SecurityMetricsCollector } from "../security/enhancedSecurityLogger.js";
import { getSecurityAnomalyService } from "../services/security/SecurityAnomalyService.js";

const router = Router();
const metricsCollector = SecurityMetricsCollector.getInstance();
const anomalyService = getSecurityAnomalyService();

router.use(requireAuth);
router.use(requireObservabilityAccess());

const alertActionSchema = z.object({
  reason: z.string().min(5).max(500),
});

const alertSuppressSchema = alertActionSchema.extend({
  suppressUntil: z.string().datetime(),
});

function resolveActor(req: Request): string {
  return req.user?.id ?? "system-admin";
}

router.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const totalEvents = Object.values(metrics).reduce((sum, count) => sum + count, 0);
    const blockedEvents = Object.entries(metrics)
      .filter(([key]) => key.includes("_blocked"))
      .reduce((sum, [, count]) => sum + count, 0);
    const errorEvents = Object.entries(metrics)
      .filter(([key]) => key.includes("_error"))
      .reduce((sum, [, count]) => sum + count, 0);

    res.json({
      timestamp: new Date().toISOString(),
      metrics,
      derived: {
        totalEvents,
        blockedEvents,
        errorEvents,
        blockRate: totalEvents > 0 ? (blockedEvents / totalEvents) * 100 : 0,
        errorRate: totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0,
      },
    });
  } catch (error) {
    logger.error("Failed to retrieve security metrics", error);
    res.status(500).json({ error: "Failed to retrieve security metrics" });
  }
});

router.get("/events", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const category = req.query.category as string;
    const severity = req.query.severity as string;

    const events = category
      ? metricsCollector.getEventsByCategory(category as never, limit)
      : severity
      ? metricsCollector.getEventsBySeverity(severity as never, limit)
      : metricsCollector.getRecentEvents(limit);

    res.json({
      timestamp: new Date().toISOString(),
      events,
      count: events.length,
    });
  } catch (error) {
    logger.error("Failed to retrieve security events", error);
    res.status(500).json({ error: "Failed to retrieve security events" });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string | undefined) ?? undefined;
    const status = (req.query.status as "open" | "acknowledged" | "suppressed" | undefined) ?? undefined;
    const includeSuppressed = req.query.includeSuppressed === "true";
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

    const alerts = await anomalyService.getAlerts({ tenantId, includeSuppressed, status, limit });

    res.json({
      timestamp: new Date().toISOString(),
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error("Failed to retrieve persisted security alerts", error);
    res.status(500).json({ error: "Failed to retrieve persisted security alerts" });
  }
});

router.post("/alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { reason } = alertActionSchema.parse(req.body ?? {});
    const acknowledged = await anomalyService.acknowledgeAlert({
      alertId,
      actorId: resolveActor(req),
      reason,
    });

    if (!acknowledged) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({ success: true, alert: acknowledged });
  } catch (error) {
    logger.error("Failed to acknowledge security alert", error);
    res.status(500).json({ error: "Failed to acknowledge security alert" });
  }
});

router.post("/alerts/:alertId/suppress", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { reason, suppressUntil } = alertSuppressSchema.parse(req.body ?? {});
    const suppressed = await anomalyService.suppressAlert({
      alertId,
      actorId: resolveActor(req),
      reason,
      suppressUntil,
    });

    if (!suppressed) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }

    res.json({ success: true, alert: suppressed });
  } catch (error) {
    logger.error("Failed to suppress security alert", error);
    res.status(500).json({ error: "Failed to suppress security alert" });
  }
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const recentEvents = metricsCollector.getRecentEvents(20);
    const alerts = await anomalyService.getAlerts({ includeSuppressed: false, limit: 200 });

    const totalEvents = Object.values(metrics).reduce((sum, count) => sum + count, 0);
    const blockedEvents = Object.entries(metrics)
      .filter(([key]) => key.includes("_blocked"))
      .reduce((sum, [, count]) => sum + count, 0);

    const openAlerts = alerts.filter((alert) => alert.status === "open");

    res.json({
      timestamp: new Date().toISOString(),
      kpis: {
        totalSecurityEvents: totalEvents,
        blockedThreats: blockedEvents,
        activeAlerts: openAlerts.length,
        securityScore: Math.max(0, 100 - blockedEvents * 2 - openAlerts.length * 3),
      },
      metrics,
      recentEvents,
      alerts: {
        open: openAlerts.slice(0, 20),
        byType: openAlerts.reduce((acc, alert) => {
          acc[alert.anomaly_type] = (acc[alert.anomaly_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      charts: {
        eventsByCategory: calculateEventsByCategory(metrics),
        eventsByOutcome: calculateEventsByOutcome(metrics),
        eventsOverTime: calculateEventsOverTime(recentEvents.map(e => ({ timestamp: e.timestamp ?? new Date().toISOString() }))),
      },
    });
  } catch (error) {
    logger.error("Failed to retrieve security dashboard data", error);
    res.status(500).json({ error: "Failed to retrieve security dashboard data" });
  }
});

router.post("/reset-metrics", async (req: Request, res: Response) => {
  try {
    metricsCollector.reset();
    logger.info("Security metrics reset by admin", { userId: req.user?.id });

    res.json({
      success: true,
      message: "Security metrics have been reset",
    });
  } catch (error) {
    logger.error("Failed to reset security metrics", error);
    res.status(500).json({ error: "Failed to reset security metrics" });
  }
});

function calculateEventsByCategory(metrics: Record<string, number>): Record<string, number> {
  const categories: Record<string, number> = {};

  Object.entries(metrics).forEach(([key, count]) => {
    const category = key.split("_")[0];
    categories[category] = (categories[category] || 0) + count;
  });

  return categories;
}

function calculateEventsByOutcome(metrics: Record<string, number>): Record<string, number> {
  const outcomes: Record<string, number> = {};

  Object.entries(metrics).forEach(([key, count]) => {
    const outcome = key.split("_")[1];
    outcomes[outcome] = (outcomes[outcome] || 0) + count;
  });

  return outcomes;
}

function calculateEventsOverTime(events: Array<{ timestamp: string }>): Array<{ timestamp: string; count: number }> {
  const hourlyBuckets: Record<string, number> = {};

  events.forEach((event) => {
    const hour = new Date(event.timestamp).toISOString().substring(0, 13);
    hourlyBuckets[hour] = (hourlyBuckets[hour] || 0) + 1;
  });

  return Object.entries(hourlyBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, count]) => ({ timestamp: `${timestamp}:00:00.000Z`, count }));
}

export default router;
