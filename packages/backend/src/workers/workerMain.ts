/**
 * Standalone worker process entrypoint.
 *
 * Runs all BullMQ workers (research + CRM + certificate generation) in a dedicated process,
 * separate from the API server. This prevents a worker OOM or crash
 * from taking down the HTTP surface.
 *
 * Usage:
 *   tsx src/workers/workerMain.ts
 *
 * In K8s, deploy as a separate Deployment (see infra/k8s/base/worker-deployment.yaml).
 */

import { createLogger } from '../lib/logger.js';
import { getQueueHealth } from '../observability/queueMetrics.js';

import {
  ARTIFACT_GENERATION_QUEUE_NAME,
  createArtifactGenerationWorker,
  getArtifactGenerationQueue,
} from './ArtifactGenerationWorker.js';
import {
  CRM_PREFETCH_QUEUE,
  CRM_SYNC_QUEUE,
  CRM_WEBHOOK_QUEUE,
  getCrmSyncQueue,
  getCrmWebhookQueue,
  getPrefetchQueue,
  initCrmWorkers,
} from './crmWorker.js';
import {
  getCertificateGenerationQueue,
  getCertificateGenerationWorker,
} from './CertificateGenerationWorker.js';
import { getResearchQueue, initResearchWorker, RESEARCH_QUEUE_NAME } from './researchWorker.js';
import {
  getReconciliationQueue,
  initStripeReconciliationWorker,
  RECONCILIATION_QUEUE_NAME,
  scheduleReconciliationJob,
} from './StripeReconciliationWorker.js';
import {
  getWatchdogQueue,
  initWorkflowWatchdogWorker,
  scheduleWatchdogJob,
  WATCHDOG_QUEUE_NAME,
} from './WorkflowWatchdogWorker.js';

const logger = createLogger({ component: 'WorkerMain' });

logger.info('Starting standalone worker process');

// Health flag for liveness probe (simple HTTP server on a separate port)
let healthy = true;

try {
  initResearchWorker();
  logger.info('Research worker initialized');
} catch (err) {
  logger.warn('Research worker failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
}

try {
  initCrmWorkers();
  logger.info('CRM workers initialized');
} catch (err) {
  logger.warn('CRM workers failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
}

try {
  createArtifactGenerationWorker();
  logger.info('Artifact generation worker initialized');
} catch (err) {
  logger.warn('Artifact generation worker failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
}

try {
  getCertificateGenerationWorker();
  logger.info('Certificate generation worker initialized');
} catch (err) {
  logger.warn('Certificate generation worker failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
}

try {
  initStripeReconciliationWorker();
  scheduleReconciliationJob().catch((err) => {
    logger.warn('Failed to schedule Stripe reconciliation job', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
  logger.info('Stripe reconciliation worker initialized');
} catch (err) {
  logger.warn('Stripe reconciliation worker failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
}

try {
  initWorkflowWatchdogWorker();
  scheduleWatchdogJob().catch((err) => {
    logger.warn('Failed to schedule workflow watchdog job', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
  logger.info('Workflow watchdog worker initialized');
} catch (err) {
  logger.warn('Workflow watchdog worker failed to start', {
    error: err instanceof Error ? err.message : String(err),
  });
}

const queueSamplerIntervalMs = 30_000;
const queueHealthSamplers = [
  { queue: getResearchQueue, queueName: RESEARCH_QUEUE_NAME, workerClass: 'research-worker' },
  { queue: getCrmSyncQueue, queueName: CRM_SYNC_QUEUE, workerClass: 'crm-sync-worker' },
  { queue: getCrmWebhookQueue, queueName: CRM_WEBHOOK_QUEUE, workerClass: 'crm-webhook-worker' },
  { queue: getPrefetchQueue, queueName: CRM_PREFETCH_QUEUE, workerClass: 'crm-prefetch-worker' },
  {
    queue: getArtifactGenerationQueue,
    queueName: ARTIFACT_GENERATION_QUEUE_NAME,
    workerClass: 'artifact-generation-worker',
  },
  {
    queue: getReconciliationQueue,
    queueName: RECONCILIATION_QUEUE_NAME,
    workerClass: 'stripe-reconciliation-worker',
  },
  {
    queue: getWatchdogQueue,
    queueName: WATCHDOG_QUEUE_NAME,
    workerClass: 'workflow-watchdog-worker',
  },
  {
    queue: getCertificateGenerationQueue,
    queueName: 'certificate-generation',
    workerClass: 'certificate-generation-worker',
  },
] as const;

const sampleQueueHealth = async () => {
  await Promise.allSettled(
    queueHealthSamplers.map(({ queue, queueName, workerClass }) =>
      getQueueHealth(queue(), queueName, {
        deployment: process.env.OBSERVABILITY_DEPLOYMENT ?? 'worker',
        workerClass,
      }),
    ),
  );
};

void sampleQueueHealth();
const queueSampler = setInterval(() => {
  void sampleQueueHealth();
}, queueSamplerIntervalMs);
queueSampler.unref();

// Minimal health endpoint for K8s liveness/readiness probes
const HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT) || 8081;

const { createServer } = await import('http');
const healthServer = createServer((_req, res) => {
  if (healthy) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'shutting_down' }));
  }
});

healthServer.listen(HEALTH_PORT, () => {
  logger.info(`Worker health endpoint listening on port ${HEALTH_PORT}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Worker received ${signal}, shutting down`);
  healthy = false;
  healthServer.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
