import type { NextFunction, Request, Response } from "express";

import { createCounter, createHistogram } from "../lib/observability/index.js";

interface PendingRequest {
  enqueuedAt: number;
  acquire: () => void;
  timeout: NodeJS.Timeout;
  aborted: boolean;
}

interface RouteQueueState {
  inFlight: number;
  queue: PendingRequest[];
}

export interface ConcurrencyBackpressureConfig {
  maxInFlight: number;
  maxQueueDepth: number;
  queueTimeoutMs: number;
  retryAfterSeconds?: number;
}

const queueRejectCounter = createCounter(
  "route_backpressure_rejections_total",
  "Requests rejected due to per-route queue backpressure"
);
const queueTimeoutCounter = createCounter(
  "route_backpressure_timeouts_total",
  "Requests dropped after waiting too long in per-route queue"
);
const queueWaitMs = createHistogram(
  "route_backpressure_wait_ms",
  "Time requests spend waiting for per-route concurrency slots",
  [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000]
);

function releaseSlot(state: RouteQueueState): void {
  const next = state.queue.shift();
  if (!next) {
    state.inFlight = Math.max(0, state.inFlight - 1);
    return;
  }

  clearTimeout(next.timeout);
  if (next.aborted) {
    releaseSlot(state);
    return;
  }

  queueWaitMs.observe(Date.now() - next.enqueuedAt);
  next.acquire();
}

export function createConcurrencyBackpressure(
  routeName: string,
  config: ConcurrencyBackpressureConfig
): (req: Request, res: Response, next: NextFunction) => void {
  const state: RouteQueueState = {
    inFlight: 0,
    queue: [],
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const attachReleaseHandler = (): void => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        releaseSlot(state);
      };

      res.once("finish", release);
      res.once("close", release);
    };

    if (state.inFlight < config.maxInFlight) {
      state.inFlight += 1;
      attachReleaseHandler();
      next();
      return;
    }

    if (state.queue.length >= config.maxQueueDepth) {
      queueRejectCounter.inc();
      if (config.retryAfterSeconds && config.retryAfterSeconds > 0) {
        res.setHeader("Retry-After", String(config.retryAfterSeconds));
      }
      res.status(503).json({
        error: "Service busy",
        message: `Backpressure active for ${routeName}. Please retry shortly.`,
        route: routeName,
      });
      return;
    }

    let acquired = false;
    const pending: PendingRequest = {
      enqueuedAt: Date.now(),
      acquire: () => {
        if (acquired || pending.aborted) return;
        acquired = true;
        state.inFlight += 1;
        attachReleaseHandler();
        next();
      },
      timeout: setTimeout(() => {
        pending.aborted = true;
        queueTimeoutCounter.inc();
        const index = state.queue.indexOf(pending);
        if (index >= 0) {
          state.queue.splice(index, 1);
        }
        if (!res.headersSent) {
          if (config.retryAfterSeconds && config.retryAfterSeconds > 0) {
            res.setHeader("Retry-After", String(config.retryAfterSeconds));
          }
          res.status(503).json({
            error: "Request queue timeout",
            message: `Request waited too long for ${routeName}. Please retry.`,
            route: routeName,
          });
        }
      }, config.queueTimeoutMs),
      aborted: false,
    };

    req.once("close", () => {
      if (acquired) return;
      pending.aborted = true;
      clearTimeout(pending.timeout);
      const index = state.queue.indexOf(pending);
      if (index >= 0) {
        state.queue.splice(index, 1);
      }
    });

    state.queue.push(pending);
  };
}
