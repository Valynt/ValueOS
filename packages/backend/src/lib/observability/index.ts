/**
 * Observability module - provides metrics creation functions backed by prom-client.
 * All metrics are registered on the shared registry from httpMetrics.ts
 * and exposed via the /metrics endpoint.
 */

import client from "prom-client";
import registry from "../metrics/httpMetrics.js";

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

/**
 * Create a counter metric registered on the shared prom-client registry.
 */
export function createCounter(name: string, help?: string): Counter {
  const existing = registry.getSingleMetric(name);
  if (existing) return existing as unknown as Counter;

  const counter = new client.Counter({
    name,
    help: help || name,
    labelNames: [] as string[],
    registers: [registry],
  });
  return counter as unknown as Counter;
}

/**
 * Create a histogram metric registered on the shared prom-client registry.
 */
export function createHistogram(name: string, help?: string, buckets?: number[]): Histogram {
  const existing = registry.getSingleMetric(name);
  if (existing) return existing as unknown as Histogram;

  const histogram = new client.Histogram({
    name,
    help: help || name,
    buckets: buckets || [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000],
    registers: [registry],
  });
  return histogram as unknown as Histogram;
}

/**
 * Create a gauge metric registered on the shared prom-client registry.
 */
export function createObservableGauge(name: string, help?: string): ObservableGauge {
  const existing = registry.getSingleMetric(name);
  if (existing) return existing as unknown as ObservableGauge;

  const gauge = new client.Gauge({
    name,
    help: help || name,
    registers: [registry],
  });
  return gauge as unknown as ObservableGauge;
}
