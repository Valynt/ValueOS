/**
 * Secret Metrics for Prometheus
 * 
 * Exposes secret-related metrics for monitoring and alerting
 * Tracks access latency, rotation success, health checks
 * 
 * Sprint 3: Kubernetes Integration
 * Created: 2024-11-29
 */

import { Register, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../../lib/logger';

/**
 * Metrics registry
 */
export class SecretMetrics {
  private register: Register;
  
  // Counters
  public secretAccessTotal: Counter;
  public secretAccessErrors: Counter;
  public secretRotationTotal: Counter;
  public secretRotationErrors: Counter;
  public secretCacheHits: Counter;
  public secretCacheMisses: Counter;

  // Histograms
  public secretAccessLatency: Histogram;
  public secretRotationDuration: Histogram;

  // Gauges
  public secretCacheSize: Gauge;
  public activeRotationJobs: Gauge;
  public secretsWatched: Gauge;

  constructor(register?: Register) {
    this.register = register || new Register();

    // Initialize counters
    this.secretAccessTotal = new Counter({
      name: 'secret_access_total',
      help: 'Total number of secret access attempts',
      labelNames: ['tenant_id', 'secret_key', 'provider', 'result'],
      registers: [this.register]
    });

    this.secretAccessErrors = new Counter({
      name: 'secret_access_errors_total',
      help: 'Total number of secret access errors',
      labelNames: ['tenant_id', 'secret_key', 'provider', 'error_type'],
      registers: [this.register]
    });

    this.secretRotationTotal = new Counter({
      name: 'secret_rotation_total',
      help: 'Total number of secret rotation attempts',
      labelNames: ['tenant_id', 'secret_key', 'result'],
      registers: [this.register]
    });

    this.secretRotationErrors = new Counter({
      name: 'secret_rotation_errors_total',
      help: 'Total number of secret rotation failures',
      labelNames: ['tenant_id', 'secret_key', 'error_type'],
      registers: [this.register]
    });

    this.secretCacheHits = new Counter({
      name: 'secret_cache_hits_total',
      help: 'Total number of secret cache hits',
      labelNames: ['tenant_id', 'provider'],
      registers: [this.register]
    });

    this.secretCacheMisses = new Counter({
      name: 'secret_cache_misses_total',
      help: 'Total number of secret cache misses',
      labelNames: ['tenant_id', 'provider'],
      registers: [this.register]
    });

    // Initialize histograms
    this.secretAccessLatency = new Histogram({
      name: 'secret_access_latency_seconds',
      help: 'Secret access latency in seconds',
      labelNames: ['tenant_id', 'provider', 'cached'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register]
    });

    this.secretRotationDuration = new Histogram({
      name: 'secret_rotation_duration_seconds',
      help: 'Secret rotation duration in seconds',
      labelNames: ['tenant_id', 'secret_key'],
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [this.register]
    });

    // Initialize gauges
    this.secretCacheSize = new Gauge({
      name: 'secret_cache_size',
      help: 'Current number of secrets in cache',
      labelNames: ['provider'],
      registers: [this.register]
    });

    this.activeRotationJobs = new Gauge({
      name: 'secret_rotation_jobs_active',
      help: 'Number of active rotation jobs',
      registers: [this.register]
    });

    this.secretsWatched = new Gauge({
      name: 'secrets_watched',
      help: 'Number of secrets currently being watched',
      registers: [this.register]
    });

    logger.info('Secret metrics initialized');
  }

  /**
   * Record secret access
   */
  recordSecretAccess(
    tenantId: string,
    secretKey: string,
    provider: string,
    success: boolean,
    latencyMs: number,
    cached: boolean
  ): void {
    const result = success ? 'success' : 'failure';

    this.secretAccessTotal.inc({
      tenant_id: tenantId,
      secret_key: secretKey,
      provider,
      result
    });

    if (cached) {
      this.secretCacheHits.inc({
        tenant_id: tenantId,
        provider
      });
    } else {
      this.secretCacheMisses.inc({
        tenant_id: tenantId,
        provider
      });
    }

    this.secretAccessLatency.observe(
      {
        tenant_id: tenantId,
        provider,
        cached: cached.toString()
      },
      latencyMs / 1000
    );
  }

  /**
   * Record secret access error
   */
  recordSecretAccessError(
    tenantId: string,
    secretKey: string,
    provider: string,
    errorType: string
  ): void {
    this.secretAccessErrors.inc({
      tenant_id: tenantId,
      secret_key: secretKey,
      provider,
      error_type: errorType
    });
  }

  /**
   * Record secret rotation
   */
  recordSecretRotation(
    tenantId: string,
    secretKey: string,
    success: boolean,
    durationMs: number
  ): void {
    const result = success ? 'success' : 'failure';

    this.secretRotationTotal.inc({
      tenant_id: tenantId,
      secret_key: secretKey,
      result
    });

    this.secretRotationDuration.observe(
      {
        tenant_id: tenantId,
        secret_key: secretKey
      },
      durationMs / 1000
    );
  }

  /**
   * Record secret rotation error
   */
  recordSecretRotationError(
    tenantId: string,
    secretKey: string,
    errorType: string
  ): void {
    this.secretRotationErrors.inc({
      tenant_id: tenantId,
      secret_key: secretKey,
      error_type: errorType
    });
  }

  /**
   * Update cache size gauge
   */
  updateCacheSize(provider: string, size: number): void {
    this.secretCacheSize.set({ provider }, size);
  }

  /**
   * Update active rotation jobs
   */
  updateActiveRotationJobs(count: number): void {
    this.activeRotationJobs.set(count);
  }

  /**
   * Update secrets watched
   */
  updateSecretsWatched(count: number): void {
    this.secretsWatched.set(count);
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get metrics registry
   */
  getRegister(): Register {
    return this.register;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.register.clear();
  }
}

/**
 * Global metrics instance
 */
export const secretMetrics = new SecretMetrics();

/**
 * Express middleware to expose metrics endpoint
 */
export function metricsMiddleware() {
  return async (_req: any, res: any) => {
    try {
      res.set('Content-Type', secretMetrics.getRegister().contentType);
      res.end(await secretMetrics.getMetrics());
    } catch (error) {
      res.status(500).end(error);
    }
  };
}
