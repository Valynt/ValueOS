import { describe, expect, it } from 'vitest';
import {
  CANONICAL_METRICS,
  METRIC_IDS,
  getMetricById,
  getMetricByName,
  getMetricsByCategory,
  getMetricsByDriverCategory,
  validateRegistry,
  MetricDefinitionSchema,
} from '../kpi_registry';

describe('KPI Registry', () => {
  it('all canonical metrics pass schema validation', () => {
    for (const metric of CANONICAL_METRICS) {
      expect(() => MetricDefinitionSchema.parse(metric)).not.toThrow();
    }
  });

  it('all metric IDs are unique', () => {
    const ids = CANONICAL_METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all metric names are unique', () => {
    const names = CANONICAL_METRICS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all metric names are snake_case', () => {
    for (const metric of CANONICAL_METRICS) {
      expect(metric.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('METRIC_IDS constants match registry entries', () => {
    for (const [, id] of Object.entries(METRIC_IDS)) {
      const metric = getMetricById(id);
      expect(metric).toBeDefined();
    }
  });

  it('validateRegistry passes without errors', () => {
    expect(() => validateRegistry()).not.toThrow();
  });

  it('contains no narrative text in metric names', () => {
    const narrativePatterns = [
      /[A-Z]/, // No uppercase (would indicate display names)
      /\s/,    // No spaces
      /['"]/,  // No quotes
    ];

    for (const metric of CANONICAL_METRICS) {
      for (const pattern of narrativePatterns) {
        expect(metric.name).not.toMatch(pattern);
      }
    }
  });
});

describe('getMetricById', () => {
  it('returns metric for valid ID', () => {
    const metric = getMetricById(METRIC_IDS.NET_PRESENT_VALUE);
    expect(metric).toBeDefined();
    expect(metric!.name).toBe('net_present_value');
  });

  it('returns undefined for unknown ID', () => {
    expect(getMetricById('00000000-0000-0000-0000-000000000000')).toBeUndefined();
  });
});

describe('getMetricByName', () => {
  it('returns metric for valid name', () => {
    const metric = getMetricByName('internal_rate_of_return');
    expect(metric).toBeDefined();
    expect(metric!.id).toBe(METRIC_IDS.INTERNAL_RATE_OF_RETURN);
  });

  it('returns undefined for unknown name', () => {
    expect(getMetricByName('nonexistent_metric')).toBeUndefined();
  });
});

describe('getMetricsByCategory', () => {
  it('returns revenue metrics', () => {
    const metrics = getMetricsByCategory('revenue');
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((m) => m.category === 'revenue')).toBe(true);
  });

  it('returns cost metrics', () => {
    const metrics = getMetricsByCategory('cost');
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((m) => m.category === 'cost')).toBe(true);
  });

  it('returns risk metrics', () => {
    const metrics = getMetricsByCategory('risk');
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('returns efficiency metrics', () => {
    const metrics = getMetricsByCategory('efficiency');
    expect(metrics.length).toBeGreaterThan(0);
  });
});

describe('getMetricsByDriverCategory', () => {
  it('returns metrics for revenue_growth drivers', () => {
    const metrics = getMetricsByDriverCategory('revenue_growth');
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((m) => m.driverCategories.includes('revenue_growth'))).toBe(true);
  });

  it('returns metrics for cost_reduction drivers', () => {
    const metrics = getMetricsByDriverCategory('cost_reduction');
    expect(metrics.length).toBeGreaterThan(0);
  });
});
