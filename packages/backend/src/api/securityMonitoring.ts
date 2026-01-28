/**
 * Security Monitoring API
 * Provides endpoints for the security dashboard to retrieve security metrics and events
 */

import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { SecurityMetricsCollector } from "../security/enhancedSecurityLogger.js";
import { createLogger } from "@shared/lib/logger";

const router = Router();
const logger = createLogger({ component: "SecurityMonitoringAPI" });
const metricsCollector = SecurityMetricsCollector.getInstance();

// Apply authentication and authorization middleware
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * GET /api/admin/security/metrics
 * Get current security metrics
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getMetrics();

    // Calculate additional derived metrics
    const totalEvents = Object.values(metrics).reduce((sum, count) => sum + count, 0);
    const blockedEvents = Object.entries(metrics)
      .filter(([key]) => key.includes("_blocked"))
      .reduce((sum, [, count]) => sum + count, 0);
    const errorEvents = Object.entries(metrics)
      .filter(([key]) => key.includes("_error"))
      .reduce((sum, [, count]) => sum + count, 0);

    const response = {
      timestamp: new Date().toISOString(),
      metrics,
      derived: {
        totalEvents,
        blockedEvents,
        errorEvents,
        blockRate: totalEvents > 0 ? (blockedEvents / totalEvents) * 100 : 0,
        errorRate: totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to retrieve security metrics", error);
    res.status(500).json({ error: "Failed to retrieve security metrics" });
  }
});

/**
 * GET /api/admin/security/events
 * Get recent security events
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const category = req.query.category as string;
    const severity = req.query.severity as string;

    let events;

    if (category) {
      events = metricsCollector.getEventsByCategory(category as any, limit);
    } else if (severity) {
      events = metricsCollector.getEventsBySeverity(severity as any, limit);
    } else {
      events = metricsCollector.getRecentEvents(limit);
    }

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

/**
 * GET /api/admin/security/alerts
 * Get active security alerts
 */
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const events = metricsCollector.getRecentEvents(100);

    // Generate alerts based on event patterns
    const alerts = [];

    // High-severity events in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentHighSeverity = events
      .filter((event) => event.severity === "high" || event.severity === "critical")
      .filter((event) => new Date(event.timestamp) > oneHourAgo);

    if (recentHighSeverity.length > 0) {
      alerts.push({
        id: "high-severity-events",
        type: "warning",
        title: "High Severity Security Events",
        description: `${recentHighSeverity.length} high/critical security events in the last hour`,
        count: recentHighSeverity.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Multiple auth failures from same IP
    const authFailures = events.filter((event) => event.type === "AUTH_FAILURE");
    const ipCounts = authFailures.reduce(
      (acc, event) => {
        const ip = event.ipAddress || "unknown";
        acc[ip] = (acc[ip] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(ipCounts).forEach(([ip, count]) => {
      if (count >= 5) {
        alerts.push({
          id: `auth-failures-${ip}`,
          type: "danger",
          title: "Multiple Authentication Failures",
          description: `${count} failed login attempts from ${ip}`,
          count,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Rate limiting alerts
    const rateLimitEvents = events.filter((event) => event.type === "RATE_LIMIT_EXCEEDED");
    if (rateLimitEvents.length > 0) {
      const recentRateLimits = rateLimitEvents.filter(
        (event) => new Date(event.timestamp) > oneHourAgo
      );

      if (recentRateLimits.length > 0) {
        alerts.push({
          id: "rate-limit-exceeded",
          type: "warning",
          title: "Rate Limiting Active",
          description: `${recentRateLimits.length} rate limit violations in the last hour`,
          count: recentRateLimits.length,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error("Failed to retrieve security alerts", error);
    res.status(500).json({ error: "Failed to retrieve security alerts" });
  }
});

/**
 * GET /api/admin/security/dashboard
 * Get comprehensive dashboard data
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const metrics = metricsCollector.getMetrics();
    const recentEvents = metricsCollector.getRecentEvents(20);

    // Calculate dashboard KPIs
    const totalEvents = Object.values(metrics).reduce((sum, count) => sum + count, 0);
    const blockedEvents = Object.entries(metrics)
      .filter(([key]) => key.includes("_blocked"))
      .reduce((sum, [, count]) => sum + count, 0);

    const dashboard = {
      timestamp: new Date().toISOString(),
      kpis: {
        totalSecurityEvents: totalEvents,
        blockedThreats: blockedEvents,
        activeAlerts: 0, // Will be calculated below
        securityScore: Math.max(0, 100 - blockedEvents * 2), // Simple scoring
      },
      metrics,
      recentEvents,
      charts: {
        eventsByCategory: calculateEventsByCategory(metrics),
        eventsByOutcome: calculateEventsByOutcome(metrics),
        eventsOverTime: calculateEventsOverTime(recentEvents),
      },
    };

    res.json(dashboard);
  } catch (error) {
    logger.error("Failed to retrieve security dashboard data", error);
    res.status(500).json({ error: "Failed to retrieve security dashboard data" });
  }
});

/**
 * POST /api/admin/security/reset-metrics
 * Reset security metrics (admin only)
 */
router.post("/reset-metrics", async (req: Request, res: Response) => {
  try {
    metricsCollector.reset();
    logger.info("Security metrics reset by admin", { userId: (req as any).user?.id });

    res.json({
      success: true,
      message: "Security metrics have been reset",
    });
  } catch (error) {
    logger.error("Failed to reset security metrics", error);
    res.status(500).json({ error: "Failed to reset security metrics" });
  }
});

// Helper functions for dashboard calculations
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

function calculateEventsOverTime(events: any[]): Array<{ timestamp: string; count: number }> {
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
