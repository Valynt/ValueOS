/**
 * Module contract for observability
 * Enforces type-level guarantees for metric creation functions
 */

export interface Counter {
  inc(labels?: Record<string, string | number>, value?: number): void;
  inc(value?: number): void;
}

export interface Histogram {
  observe(labels: Record<string, string | number>, value: number): void;
  observe(value: number): void;
}

export interface ObservableGauge {
  set(labels: Record<string, string | number>, value: number): void;
  set(value: number): void;
}

export function createCounter(name: string, help?: string, labelNames?: string[]): Counter;
export function createHistogram(
  name: string,
  help?: string,
  buckets?: number[],
  labelNames?: string[],
): Histogram;
export function createObservableGauge(
  name: string,
  help?: string,
  labelNames?: string[],
): ObservableGauge;
