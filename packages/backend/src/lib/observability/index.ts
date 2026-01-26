/**
 * Observability module - provides metrics creation functions
 * 
 * Minimal implementation for local DX that satisfies imports.
 * In production, this would use prom-client or OpenTelemetry.
 */

type Labels = Record<string, string | number>;

interface Counter {
  inc(labels?: Labels, value?: number): void;
  inc(value?: number): void;
}

interface Histogram {
  observe(labels: Labels, value: number): void;
  observe(value: number): void;
}

interface ObservableGauge {
  set(value: number): void;
}

class NoopCounter implements Counter {
  inc(_labelsOrValue?: Labels | number, _value?: number): void {
    // No-op for local development
  }
}

class NoopHistogram implements Histogram {
  observe(_labelsOrValue: Labels | number, _value?: number): void {
    // No-op for local development
  }
}

class NoopGauge implements ObservableGauge {
  set(_value: number): void {
    // No-op for local development
  }
}

/**
 * Create a counter metric
 */
export function createCounter(name: string, help?: string): Counter {
  return new NoopCounter();
}

/**
 * Create a histogram metric
 */
export function createHistogram(name: string, help?: string, buckets?: number[]): Histogram {
  return new NoopHistogram();
}

/**
 * Create an observable gauge metric
 */
export function createObservableGauge(name: string, help?: string): ObservableGauge {
  return new NoopGauge();
}
