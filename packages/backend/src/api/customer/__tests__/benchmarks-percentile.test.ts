import { describe, expect, it } from 'vitest';

import {
  calculatePercentile,
  type BenchmarkData,
  ratePerformance
} from '../benchmarks.js';

const baseBenchmark: BenchmarkData = {
  id: 'benchmark-1',
  kpi_name: 'Retention',
  industry: 'technology',
  company_size: null,
  p25: 10,
  median: 20,
  p75: 30,
  best_in_class: 40,
  unit: '%',
  source: 'test-source',
  vintage: '2026',
  sample_size: 100
};

describe('calculatePercentile', () => {
  it('returns null percentile and unknown rating when p25 is zero', () => {
    const benchmark: BenchmarkData = {
      ...baseBenchmark,
      p25: 0
    };

    expect(calculatePercentile(5, benchmark)).toBeNull();
    expect(ratePerformance(5, benchmark)).toBe('unknown');
  });

  it('handles equal median and p25 without NaN/Infinity', () => {
    const benchmark: BenchmarkData = {
      ...baseBenchmark,
      p25: 20,
      median: 20,
      p75: 30,
      best_in_class: 40
    };

    const percentile = calculatePercentile(20, benchmark);

    expect(percentile).toBe(25);
    expect(percentile).not.toBeNaN();
    expect(percentile).not.toBe(Infinity);
  });

  it('handles equal best_in_class and p75 without NaN/Infinity', () => {
    const benchmark: BenchmarkData = {
      ...baseBenchmark,
      p25: 10,
      median: 20,
      p75: 30,
      best_in_class: 30
    };

    const percentile = calculatePercentile(30, benchmark);

    expect(percentile).toBe(75);
    expect(percentile).not.toBeNaN();
    expect(percentile).not.toBe(Infinity);
  });

  it('returns null percentile and unknown rating for out-of-order quantiles', () => {
    const benchmark: BenchmarkData = {
      ...baseBenchmark,
      p25: 30,
      median: 20,
      p75: 40,
      best_in_class: 50
    };

    expect(calculatePercentile(35, benchmark)).toBeNull();
    expect(ratePerformance(35, benchmark)).toBe('unknown');
  });
});
