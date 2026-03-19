import type { Histogram } from "@opentelemetry/api";
import { logger } from "@shared/lib/logger";
import { NextFunction, Request, Response } from "express";

import { CANONICAL_SLO_THRESHOLDS, classifyLatencyClass, ORCHESTRATION_ROUTE_PREFIXES } from "../config/slo.js";
import { createHistogram } from "../config/telemetry.js";

const WINDOW_SIZE = 120;
const latencyWindows = new Map<string, number[]>();

const LATENCY_CLASS_SLOS = {
  interactive: {
    completionP95Ms: CANONICAL_SLO_THRESHOLDS.interactiveLatencyP95Ms,
  },
  orchestration: {
    ttfbP95Ms: CANONICAL_SLO_THRESHOLDS.orchestrationTtfbP95Ms,
    completionP95Ms: CANONICAL_SLO_THRESHOLDS.orchestrationCompletionP95Ms,
  },
} as const;

type LatencyClass = keyof typeof LATENCY_CLASS_SLOS;

type RouteLatencyClassification = {
  routeKey: string;
  latencyClass: LatencyClass;
  sloModel: "completion" | "ttfb_and_completion";
};

let latencyHistogram: Histogram | null = null;

async function getLatencyHistogram(): Promise<Histogram> {
  if (!latencyHistogram) {
    latencyHistogram = await createHistogram(
      "api.request.duration",
      "Duration of API requests in milliseconds",
    );
  }
  return latencyHistogram;
}

function classifyRoute(pathname: string): RouteLatencyClassification {
  const latencyClass = classifyLatencyClass(pathname);
  const orchestrationRoute = ORCHESTRATION_ROUTE_PREFIXES.find((route) => pathname.startsWith(route));

  if (latencyClass === "orchestration" && orchestrationRoute) {
    return {
      routeKey: orchestrationRoute,
      latencyClass,
      sloModel: "ttfb_and_completion",
    };
  }

  return {
    routeKey: pathname,
    latencyClass,
    sloModel: "completion",
  };
}

function recordDuration(route: string, duration: number) {
  const bucket = latencyWindows.get(route) || [];
  bucket.push(duration);
  if (bucket.length > WINDOW_SIZE) {
    bucket.shift();
  }
  latencyWindows.set(route, bucket);
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[idx];
}

export function getLatencySnapshot() {
  const snapshot: Record<string, { p50: number; p95: number; count: number }> =
    {};

  latencyWindows.forEach((durations, route) => {
    snapshot[route] = {
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      count: durations.length,
    };
  });

  return snapshot;
}

export function latencyMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const classification = classifyRoute(req.path);

    res.on("finish", async () => {
      const duration = Date.now() - start;

      recordDuration(classification.routeKey, duration);

      const histogram = await getLatencyHistogram();
      histogram.record(duration, {
        "http.route": classification.routeKey,
        "http.method": req.method,
        "http.status_code": res.statusCode,
        "latency.class": classification.latencyClass,
        "latency.slo_model": classification.sloModel,
      });

      if (classification.latencyClass === "orchestration") {
        const snapshot = getLatencySnapshot();
        logger.debug("Orchestration latency updated", {
          route: classification.routeKey,
          duration_ms: duration,
          completion_p95_ms: snapshot[classification.routeKey]?.p95,
          ttfb_target_ms: LATENCY_CLASS_SLOS.orchestration.ttfbP95Ms,
          completion_target_ms:
            LATENCY_CLASS_SLOS.orchestration.completionP95Ms,
          guidance:
            "Exclude orchestration routes from the universal 200ms completion SLO unless they are redesigned as interactive endpoints.",
        });
        return;
      }

      const snapshot = getLatencySnapshot();
      logger.debug("Interactive latency updated", {
        route: classification.routeKey,
        duration_ms: duration,
        completion_p95_ms: snapshot[classification.routeKey]?.p95,
        completion_target_ms: LATENCY_CLASS_SLOS.interactive.completionP95Ms,
      });
    });

    next();
  };
}
