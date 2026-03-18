/**
 * BullMQ queue observability.
 *
 * Two entry points:
 *
 *   attachQueueMetrics(worker, queueName)
 *     — Attach metric-emitting listeners to an existing Worker instance.
 *       Call once per worker after it is initialised. Safe to call multiple
 *       times on the same worker (listeners are additive, not replaced).
 *
 *   getQueueHealth(queue)
 *     — Poll a Queue instance for current job counts and stall indicators.
 *       Used by /health/dependencies to report queue status without requiring
 *       a live worker connection.
 */

import { createLogger } from "@shared/lib/logger";
import type { Job, Queue, Worker } from "bullmq";

import { createCounter, createObservableGauge } from "../lib/observability/index.js";

const logger = createLogger({ component: "QueueMetrics" });

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** Total job completions/failures/stalls per queue. */
const jobTotalCounter = createCounter(
  "queue_job_total",
  "Total BullMQ job events by queue and status",
);

/** Job processing duration in seconds. Initialized lazily after module load. */
let jobDurationHistogram: { observe: (labels: Record<string, string>, value: number) => void } | null = null;
async function getJobDurationHistogram() {
  if (!jobDurationHistogram) {
    const { createHistogram } = await import("../lib/observability/index.js");
    jobDurationHistogram = createHistogram(
      "queue_job_duration_seconds",
      "BullMQ job processing duration in seconds",
    );
  }
  return jobDurationHistogram;
}

/** Current waiting + delayed job count per queue (consumer lag proxy). */
const consumerLagGauge = createObservableGauge(
  "queue_consumer_lag",
  "Waiting + delayed job count per BullMQ queue",
);

/** Stalled job count per queue. */
const stalledJobCounter = createCounter(
  "queue_stalled_job_total",
  "BullMQ jobs that stalled (active without heartbeat)",
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueueHealthResult {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  /** Approximate stall count — jobs active longer than the stall interval. */
  stalledCount: number;
  lastFailedAt: string | null;
  checkedAt: string;
}

// ─── In-memory last-failure tracker ──────────────────────────────────────────

const lastFailedAt = new Map<string, string>();

// ─── Worker listener attachment ───────────────────────────────────────────────

/**
 * Attach Prometheus metric listeners to an existing BullMQ Worker.
 *
 * Designed to be called once per worker after initialisation. Adds listeners
 * alongside any existing ones — does not replace them.
 */
export function attachQueueMetrics(worker: Worker, queueName: string): void {
  worker.on("completed", (job: Job) => {
    jobTotalCounter.inc({ queue: queueName, status: "completed" });

    const processedOn = job.processedOn ?? Date.now();
    const finishedOn = job.finishedOn ?? Date.now();
    const durationSeconds = (finishedOn - processedOn) / 1000;
    if (durationSeconds >= 0) {
      getJobDurationHistogram().then(h => h.observe({ queue: queueName }, durationSeconds)).catch(() => {});
    }
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    jobTotalCounter.inc({ queue: queueName, status: "failed" });
    lastFailedAt.set(queueName, new Date().toISOString());

    // Log structured failure context — no PII, only job metadata.
    logger.error("BullMQ job failed", {
      queue: queueName,
      jobId: job?.id,
      failedReason: err.message,
      attemptsMade: job?.attemptsMade,
      caseId: (job?.data as Record<string, unknown> | undefined)?.caseId,
      orgId: (job?.data as Record<string, unknown> | undefined)?.orgId,
    });
  });

  worker.on("stalled" as Parameters<typeof worker.on>[0], (jobId: string) => {
    stalledJobCounter.inc({ queue: queueName });
    logger.warn("BullMQ job stalled", { queue: queueName, jobId });
  });

  worker.on("active", (_job: Job) => {
    jobTotalCounter.inc({ queue: queueName, status: "active" });
  });
}

// ─── Queue health polling ─────────────────────────────────────────────────────

/**
 * Poll a Queue instance for current job counts.
 *
 * Falls back gracefully if Redis is unavailable — returns zeros rather than
 * throwing, so the health endpoint remains responsive.
 */
export async function getQueueHealth(
  queue: Queue,
  queueName: string,
): Promise<QueueHealthResult> {
  const checkedAt = new Date().toISOString();

  try {
    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "failed",
      "completed",
    );

    const waiting = counts.waiting ?? 0;
    const active = counts.active ?? 0;
    const delayed = counts.delayed ?? 0;
    const failed = counts.failed ?? 0;
    const completed = counts.completed ?? 0;

    // Consumer lag = jobs that are queued but not yet being processed.
    consumerLagGauge.set(waiting + delayed);

    // Stalled jobs: BullMQ tracks these internally; we approximate by checking
    // for jobs in "active" state that have exceeded the stall interval.
    // getJobCounts does not expose stalled directly — use getStalledCount if available.
    let stalledCount = 0;
    try {
      // getStalledCount is available in BullMQ ≥4 via queue-getters
      const stalledJobs = await (queue as Queue & { getStalledCount?: () => Promise<number> }).getStalledCount?.();
      stalledCount = stalledJobs ?? 0;
      if (stalledCount > 0) {
        stalledJobCounter.inc({ queue: queueName });
      }
    } catch {
      // Not available in this version — skip silently.
    }

    return {
      queue: queueName,
      waiting,
      active,
      delayed,
      failed,
      completed,
      stalledCount,
      lastFailedAt: lastFailedAt.get(queueName) ?? null,
      checkedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Queue health poll failed", { queue: queueName, error: message });

    return {
      queue: queueName,
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      stalledCount: 0,
      lastFailedAt: lastFailedAt.get(queueName) ?? null,
      checkedAt,
    };
  }
}
