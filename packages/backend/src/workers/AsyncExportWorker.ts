/**
 * AsyncExportWorker
 *
 * BullMQ worker that processes 'export-job' queue for async PDF/PPTX generation.
 *
 * For each job it:
 *   1. Marks the export_jobs row as 'running'
 *   2. Streams progress updates via export_job_events table
 *   3. Calls PptxExportService or PdfExportService with progress callbacks
 *   4. Stores the result and marks job 'completed'
 *
 * On error: marks job 'failed' with error details.
 *
 * @task P0 - Async Export Queue
 */

import { Queue, Worker, type Job } from "bullmq";

import { logger } from "../lib/logger.js";
import { getAgentMessageQueueConfig } from "../config/ServiceConfigManager.js";
import { attachQueueMetrics } from "../observability/queueMetrics.js";
import { withIdempotency } from "./IdempotentJobProcessor.js";
import { runJobWithTenantContext } from "./tenantContextBootstrap.js";

import { ExportJobRepository, type ExportJob, type ExportFormat } from "../services/export/ExportJobRepository.js";
import { PptxExportService, type PptxExportInput } from "../services/export/PptxExportService.js";
import { PdfExportService, type PdfExportInput } from "../services/export/PdfExportService.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportJobPayload {
  jobId: string;
  tenantId: string;
  organizationId: string;
  caseId: string;
  userId: string;
  format: ExportFormat;
  exportType: string;
  title?: string;
  ownerName?: string;
  renderUrl?: string;
  traceId: string;
}

// ---------------------------------------------------------------------------
// Queue name
// ---------------------------------------------------------------------------

const QUEUE_NAME = "export-jobs";

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

/**
 * Process a single export job. Exported for testing.
 */
export async function processJob(job: Job<ExportJobPayload>): Promise<void> {
  const {
    jobId,
    tenantId,
    organizationId,
    caseId,
    userId,
    format,
    exportType,
    title,
    ownerName,
    renderUrl,
    traceId,
  } = job.data;

  logger.info("AsyncExportWorker: starting job", {
    jobId,
    caseId,
    tenantId,
    format,
    exportType,
    traceId,
  });

  const jobRepo = new ExportJobRepository();

  // Mark job as running
  await jobRepo.markRunning(jobId, tenantId);

  try {
    if (format === "pptx") {
      await processPptxExport(jobRepo, job.data);
    } else if (format === "pdf") {
      await processPdfExport(jobRepo, job.data);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    logger.info("AsyncExportWorker: job completed", {
      jobId,
      caseId,
      format,
      traceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof Error && "code" in err ? (err as Error & { code: string }).code : undefined;

    logger.error("AsyncExportWorker: export failed", {
      jobId,
      caseId,
      format,
      error: message,
      errorCode,
      traceId,
    });

    await jobRepo.markFailed(jobId, tenantId, message, errorCode);
    throw err;
  }
}

async function processPptxExport(
  jobRepo: ExportJobRepository,
  data: ExportJobPayload
): Promise<void> {
  const { jobId, tenantId, caseId, title, ownerName } = data;

  // Step 1: Fetch data (20%)
  await jobRepo.updateProgress(jobId, tenantId, "fetch_data", "in_progress", 50, 10, "Loading case data...");

  const exportService = new PptxExportService(
    async (step, progress, message) => {
      // Map service steps to our progress steps with accurate weight calculations
      const stepMap: Record<string, { name: string; overallBase: number; weight: number }> = {
        fetch: { name: "fetch_data", overallBase: 0, weight: 20 },
        build: { name: "build_deck", overallBase: 20, weight: 30 },
        slides: { name: "add_slides", overallBase: 50, weight: 30 },
        upload: { name: "upload", overallBase: 80, weight: 15 },
        finalize: { name: "finalize", overallBase: 95, weight: 5 },
      };

      const mapped = stepMap[step];
      if (mapped) {
        // Calculate overall percent: base + (step progress * step weight / 100)
        const overallPercent = mapped.overallBase + (progress * mapped.weight / 100);
        await jobRepo.updateProgress(
          jobId,
          tenantId,
          mapped.name,
          progress < 100 ? "in_progress" : "completed",
          progress,
          Math.round(overallPercent),
          message
        );
      }
    }
  );

  // Complete fetch step
  await jobRepo.updateProgress(jobId, tenantId, "fetch_data", "completed", 100, 20, "Data loaded");

  // Step 2: Build deck (20% -> 50%)
  await jobRepo.updateProgress(jobId, tenantId, "build_deck", "in_progress", 0, 25, "Building presentation...");

  const result = await exportService.exportValueCase({
    organizationId: tenantId,
    caseId,
    title: title ?? `Value Case ${caseId}`,
    ownerName,
  });

  // Mark completed
  await jobRepo.markCompleted(jobId, tenantId, {
    storagePath: result.storagePath,
    signedUrl: result.signedUrl,
    signedUrlExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    fileSizeBytes: result.sizeBytes,
  });
}

async function processPdfExport(
  jobRepo: ExportJobRepository,
  data: ExportJobPayload
): Promise<void> {
  const { jobId, tenantId, caseId, renderUrl } = data;

  if (!renderUrl) {
    throw new Error("PDF export requires renderUrl");
  }

  // Step 1: Validate integrity (0% -> 10%)
  await jobRepo.updateProgress(
    jobId,
    tenantId,
    "validate_integrity",
    "in_progress",
    50,
    5,
    "Validating integrity..."
  );

  // Note: Integrity check is done before job is queued in the API handler
  // This step is mostly for UX consistency
  await jobRepo.updateProgress(
    jobId,
    tenantId,
    "validate_integrity",
    "completed",
    100,
    10,
    "Integrity validated"
  );

  // Step 2: Launch browser (10% -> 20%)
  await jobRepo.updateProgress(jobId, tenantId, "launch_browser", "in_progress", 50, 15, "Launching browser...");

  const exportService = new PdfExportService(
    async (step, progress, message) => {
      const stepMap: Record<string, { name: string; overallBase: number; weight: number }> = {
        launch: { name: "launch_browser", overallBase: 10, weight: 10 },
        render: { name: "render_page", overallBase: 20, weight: 30 },
        generate: { name: "generate_pdf", overallBase: 50, weight: 30 },
        upload: { name: "upload", overallBase: 80, weight: 15 },
        finalize: { name: "finalize", overallBase: 95, weight: 5 },
      };

      const mapped = stepMap[step];
      if (mapped) {
        // Calculate overall percent: base + (step progress * step weight / 100)
        const overallPercent = mapped.overallBase + (progress * mapped.weight / 100);
        await jobRepo.updateProgress(
          jobId,
          tenantId,
          mapped.name,
          progress < 100 ? "in_progress" : "completed",
          progress,
          Math.round(overallPercent),
          message
        );
      }
    }
  );

  await jobRepo.updateProgress(jobId, tenantId, "launch_browser", "completed", 100, 20, "Browser ready");

  // Step 3: Render page (20% -> 50%)
  await jobRepo.updateProgress(jobId, tenantId, "render_page", "in_progress", 0, 25, "Loading page...");

  const result = await exportService.exportValueCase({
    organizationId: tenantId,
    caseId,
    renderUrl,
    authToken: undefined, // Token is managed via cookie injection in service
    title: data.title ?? `Value Case ${caseId}`,
  });

  // Mark completed
  await jobRepo.markCompleted(jobId, tenantId, {
    storagePath: result.storagePath,
    signedUrl: result.signedUrl,
    signedUrlExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    fileSizeBytes: result.sizeBytes,
  });
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export function createAsyncExportWorker(): Worker<ExportJobPayload> {
  const config = getAgentMessageQueueConfig();
  const redisUrl = config.redis.url ?? "redis://localhost:6379";

  const worker = new Worker<ExportJobPayload>(
    QUEUE_NAME,
    async (job) =>
      runJobWithTenantContext(
        {
          workerName: "AsyncExportWorker",
          tenantId: job.data.tenantId,
          organizationId: job.data.organizationId,
        },
        withIdempotency(QUEUE_NAME, async () => processJob(job), {
          enabled: true,
          ttlHours: 24,
          keyFields: ["jobId", "tenantId", "caseId", "format"],
        })
      ),
    {
      connection: { url: redisUrl },
      concurrency: 2, // Lower concurrency for memory-intensive PDF/PPTX generation
    }
  );

  worker.on("failed", (job, err) => {
    logger.error("AsyncExportWorker: job failed", {
      jobId: job?.data?.jobId,
      caseId: job?.data?.caseId,
      format: job?.data?.format,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("AsyncExportWorker: worker connection error", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  worker.on("completed", (job) => {
    logger.info("AsyncExportWorker: job completed", {
      jobId: job.data.jobId,
      caseId: job.data.caseId,
      format: job.data.format,
    });
  });

  attachQueueMetrics(worker, QUEUE_NAME, {
    workerClass: "async-export-worker",
    concurrency: 2,
  });

  logger.info("AsyncExportWorker: started", { queue: QUEUE_NAME });

  return worker;
}

// ---------------------------------------------------------------------------
// Queue factory for enqueueing jobs
// ---------------------------------------------------------------------------

let _queue: Queue<ExportJobPayload> | null = null;

/**
 * Close the async export queue gracefully.
 * Call this during process shutdown to ensure jobs are persisted.
 */
export async function closeAsyncExportQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
    logger.info("AsyncExportWorker: queue closed gracefully");
  }
}

export function getAsyncExportQueue(): Queue<ExportJobPayload> {
  if (!_queue) {
    const config = getAgentMessageQueueConfig();
    const redisUrl = config.redis.url ?? "redis://localhost:6379";
    _queue = new Queue<ExportJobPayload>(QUEUE_NAME, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    });
  }

  return _queue;
}

export { QUEUE_NAME as ASYNC_EXPORT_QUEUE_NAME };
