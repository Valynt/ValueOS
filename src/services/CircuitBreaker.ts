import { logger } from '../lib/logger';
import { CircuitBreakerState } from '../types/workflow';

export interface CircuitBreakerConfig {
  windowMs: number;
  failureRateThreshold: number;
  latencyThresholdMs: number;
  minimumSamples: number;
  timeoutMs: number;
  halfOpenMaxProbes: number;
}

interface CircuitBreakerMetric {
  timestamp: number;
  success: boolean;
  durationMs: number;
}

export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreakerState>();

  constructor(private defaults: CircuitBreakerConfig = {
    windowMs: 60_000,
    failureRateThreshold: 0.5,
    latencyThresholdMs: 2_000,
    minimumSamples: 5,
    timeoutMs: 30_000,
    halfOpenMaxProbes: 1
  }) {}

  async execute<T>(
    key: string,
    task: () => Promise<T>,
    overrides: Partial<CircuitBreakerConfig> = {}
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(key, overrides);
    this.ensureAvailability(breaker);

    if (breaker.state === 'half_open') {
      breaker.half_open_probes += 1;
    }

    const start = Date.now();
    let success = false;
    try {
      const result = await task();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - start;
      this.recordMetric(breaker, { timestamp: Date.now(), success, durationMs: duration });
      this.evaluateBreaker(breaker, success);

      if (breaker.state === 'half_open') {
        breaker.half_open_probes = Math.max(0, breaker.half_open_probes - 1);
      }
    }
  }

  exportState(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.breakers);
  }

  getState(key: string): CircuitBreakerState | undefined {
    return this.breakers.get(key);
  }

  reset(key: string): void {
    if (this.breakers.has(key)) {
      this.breakers.delete(key);
    }
  }

  private getOrCreateBreaker(
    key: string,
    overrides: Partial<CircuitBreakerConfig>
  ): CircuitBreakerState {
    if (!this.breakers.has(key)) {
      const config = { ...this.defaults, ...overrides };
      this.breakers.set(key, {
        failure_count: 0,
        last_failure_time: null,
        state: 'closed',
        timeout_seconds: Math.ceil(config.timeoutMs / 1000),
        metrics: [],
        opened_at: null,
        half_open_probes: 0,
        failure_rate_threshold: config.failureRateThreshold,
        latency_threshold_ms: config.latencyThresholdMs,
        window_ms: config.windowMs,
        minimum_samples: config.minimumSamples,
        half_open_max_probes: config.halfOpenMaxProbes
      });
    }

    const existing = this.breakers.get(key)!;
    this.applyOverrides(existing, overrides);
    return existing;
  }

  private applyOverrides(breaker: CircuitBreakerState, overrides: Partial<CircuitBreakerConfig>): void {
    if (Object.keys(overrides).length === 0) return;

    breaker.window_ms = overrides.windowMs ?? breaker.window_ms;
    breaker.failure_rate_threshold = overrides.failureRateThreshold ?? breaker.failure_rate_threshold;
    breaker.latency_threshold_ms = overrides.latencyThresholdMs ?? breaker.latency_threshold_ms;
    breaker.minimum_samples = overrides.minimumSamples ?? breaker.minimum_samples;
    breaker.timeout_seconds = Math.ceil((overrides.timeoutMs ?? breaker.timeout_seconds * 1000) / 1000);
    breaker.half_open_max_probes = overrides.halfOpenMaxProbes ?? breaker.half_open_max_probes;
  }

  private ensureAvailability(breaker: CircuitBreakerState): void {
    if (breaker.state === 'open') {
      const openedAt = breaker.opened_at ? new Date(breaker.opened_at).getTime() : 0;
      const elapsed = Date.now() - openedAt;
      if (elapsed >= breaker.timeout_seconds * 1000) {
        breaker.state = 'half_open';
        breaker.half_open_probes = 0;
      } else {
        throw new Error('Circuit breaker open');
      }
    }

    if (breaker.state === 'half_open' && breaker.half_open_probes >= breaker.half_open_max_probes) {
      throw new Error('Circuit breaker half-open probe already in progress');
    }
  }

  private pruneMetrics(breaker: CircuitBreakerState): void {
    const cutoff = Date.now() - breaker.window_ms;
    breaker.metrics = breaker.metrics.filter(metric => metric.timestamp >= cutoff);
    
    // Limit metrics array size to prevent unbounded growth
    // Keep at most 10x minimum_samples or 100 metrics, whichever is larger
    const maxMetrics = Math.max(breaker.minimum_samples * 10, 100);
    if (breaker.metrics.length > maxMetrics) {
      breaker.metrics = breaker.metrics.slice(-maxMetrics);
    }
  }

  private recordMetric(breaker: CircuitBreakerState, metric: CircuitBreakerMetric): void {
    this.pruneMetrics(breaker);
    breaker.metrics.push(metric);
    breaker.failure_count = breaker.metrics.filter(m => !m.success).length;
    if (!metric.success) {
      breaker.last_failure_time = new Date(metric.timestamp).toISOString();
    }
  }

  private evaluateBreaker(breaker: CircuitBreakerState, lastSuccess: boolean): void {
    this.pruneMetrics(breaker);
    const total = breaker.metrics.length;
    const failures = breaker.metrics.filter(m => !m.success).length;
    const avgLatency = total === 0 ? 0 : breaker.metrics.reduce((sum, m) => sum + m.durationMs, 0) / total;
    const failureRate = total === 0 ? 0 : failures / total;

    if (breaker.state === 'half_open' && !lastSuccess) {
      breaker.state = 'open';
      breaker.opened_at = new Date().toISOString();
      breaker.half_open_probes = 0;
      return;
    }

    const isFailureRateExceeded = failureRate >= breaker.failure_rate_threshold;
    const isLatencyExceeded = avgLatency >= breaker.latency_threshold_ms;
    if (total >= breaker.minimum_samples && (isFailureRateExceeded || isLatencyExceeded)) {
      breaker.state = 'open';
      breaker.opened_at = new Date().toISOString();
      breaker.half_open_probes = 0;
      return;
    }

    if (breaker.state === 'half_open' && lastSuccess) {
      breaker.state = 'closed';
      breaker.failure_count = 0;
      breaker.opened_at = null;
      breaker.last_failure_time = null;
      // Metrics are already pruned by pruneMetrics() call above
    }
  }
}
