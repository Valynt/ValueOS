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

import { createArtifactGenerationWorker } from './ArtifactGenerationWorker.js';
import { initCrmWorkers } from './crmWorker.js';
import { initResearchWorker } from './researchWorker.js';
import { getCertificateGenerationWorker } from './CertificateGenerationWorker.js';

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
