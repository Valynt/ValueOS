import { NextFunction, Request, Response } from "express";

import { classifyLatencyClass } from "../config/slo.js";
import registry, { httpRequestDuration, httpRequestTtfb, httpRequestsTotal } from "../lib/metrics/httpMetrics.js";

/**
 * Express middleware factory to record request durations and counts.
 * Metrics use the valuecanvas_http_* naming convention to match SLO alert rules.
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startMs = performance.now();
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalWriteHead = res.writeHead.bind(res);
    const originalFlushHeaders = res.flushHeaders?.bind(res);

    let route = req.route?.path || req.path || "unknown";
    let firstByteRecorded = false;

    const buildLabels = () => {
      route = req.route?.path || req.path || route || "unknown";

      return {
        method: req.method,
        route,
        status_code: String(res.statusCode),
        latency_class: classifyLatencyClass(route),
      };
    };

    const recordFirstByte = () => {
      if (firstByteRecorded) {
        return;
      }

      firstByteRecorded = true;
      httpRequestTtfb.observe(buildLabels(), performance.now() - startMs);
    };

    res.write = ((...args: Parameters<Response["write"]>) => {
      recordFirstByte();
      return originalWrite(...args);
    }) as Response["write"];

    res.end = ((...args: Parameters<Response["end"]>) => {
      recordFirstByte();
      return originalEnd(...args);
    }) as Response["end"];

    res.writeHead = ((...args: Parameters<Response["writeHead"]>) => {
      recordFirstByte();
      return originalWriteHead(...args);
    }) as Response["writeHead"];

    if (originalFlushHeaders) {
      res.flushHeaders = (() => {
        recordFirstByte();
        return originalFlushHeaders();
      }) as Response["flushHeaders"];
    }

    res.on("finish", () => {
      const durationMs = performance.now() - startMs;
      recordFirstByte();
      const labels = buildLabels();
      httpRequestDuration.observe(labels, durationMs);
      httpRequestsTotal.inc(labels);
    });
    next();
  };
}

export function getMetricsRegistry() {
  return registry;
}
