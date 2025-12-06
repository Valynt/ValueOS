import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { performanceMonitor, PERFORMANCE_BENCHMARKS, debounce } from '../performance';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.disconnect();
  });

  describe('startMeasure', () => {
    it('returns a function that measures elapsed time', () => {
      const endMeasure = performanceMonitor.startMeasure('test-operation');
      
      const duration = endMeasure();
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(typeof duration).toBe('number');
    });

    it('records metric when measurement ends', () => {
      const endMeasure = performanceMonitor.startMeasure('test-metric');
      endMeasure();
      
      const metrics = performanceMonitor.getMetrics('test-metric');
      
      expect(metrics.length).toBe(1);
      expect(metrics[0].name).toBe('test-metric');
      expect(metrics[0].unit).toBe('ms');
    });

    it('measures actual elapsed time accurately', async () => {
      const endMeasure = performanceMonitor.startMeasure('delay-test');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const duration = endMeasure();
      
      expect(duration).toBeGreaterThanOrEqual(45);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('recordMetric', () => {
    it('stores metrics correctly', () => {
      performanceMonitor.recordMetric({
        name: 'custom-metric',
        value: 150,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      const metrics = performanceMonitor.getMetrics('custom-metric');
      
      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBe(150);
    });

    it('limits stored metrics to 1000 entries', () => {
      for (let i = 0; i < 1100; i++) {
        performanceMonitor.recordMetric({
          name: 'bulk-metric',
          value: i,
          unit: 'ms',
          timestamp: Date.now(),
        });
      }
      
      const metrics = performanceMonitor.getMetrics('bulk-metric');
      
      expect(metrics.length).toBe(1000);
    });

    it('keeps most recent metrics when limit exceeded', () => {
      for (let i = 0; i < 1100; i++) {
        performanceMonitor.recordMetric({
          name: 'recent-test',
          value: i,
          unit: 'ms',
          timestamp: Date.now(),
        });
      }
      
      const metrics = performanceMonitor.getMetrics('recent-test');
      const firstValue = metrics[0].value;
      
      expect(firstValue).toBeGreaterThanOrEqual(100);
    });
  });

  describe('getMetrics', () => {
    it('returns empty array for non-existent metric', () => {
      const metrics = performanceMonitor.getMetrics('non-existent');
      
      expect(metrics).toEqual([]);
    });

    it('filters metrics by name correctly', () => {
      performanceMonitor.recordMetric({
        name: 'metric-a',
        value: 100,
        unit: 'ms',
        timestamp: Date.now(),
      });
      performanceMonitor.recordMetric({
        name: 'metric-b',
        value: 200,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      const metricsA = performanceMonitor.getMetrics('metric-a');
      
      expect(metricsA.length).toBe(1);
      expect(metricsA[0].name).toBe('metric-a');
    });
  });

  describe('getAverage', () => {
    it('returns 0 for metrics with no data', () => {
      const avg = performanceMonitor.getAverage('empty-metric');
      
      expect(avg).toBe(0);
    });

    it('calculates average correctly for single metric', () => {
      performanceMonitor.recordMetric({
        name: 'single-metric',
        value: 150,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      const avg = performanceMonitor.getAverage('single-metric');
      
      expect(avg).toBe(150);
    });

    it('calculates average correctly for multiple metrics', () => {
      const values = [100, 200, 300];
      values.forEach(value => {
        performanceMonitor.recordMetric({
          name: 'avg-test',
          value,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
      
      const avg = performanceMonitor.getAverage('avg-test');
      
      expect(avg).toBe(200);
    });
  });

  describe('getPercentile', () => {
    it('returns 0 for empty metrics', () => {
      const p95 = performanceMonitor.getPercentile('empty', 95);
      
      expect(p95).toBe(0);
    });

    it('calculates p50 correctly', () => {
      const values = [10, 20, 30, 40, 50];
      values.forEach(value => {
        performanceMonitor.recordMetric({
          name: 'p50-test',
          value,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
      
      const p50 = performanceMonitor.getPercentile('p50-test', 50);
      
      expect(p50).toBe(30);
    });

    it('calculates p95 correctly', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      values.forEach(value => {
        performanceMonitor.recordMetric({
          name: 'p95-test',
          value,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
      
      const p95 = performanceMonitor.getPercentile('p95-test', 95);
      
      expect(p95).toBeGreaterThanOrEqual(94);
      expect(p95).toBeLessThanOrEqual(96);
    });

    it('handles single value correctly', () => {
      performanceMonitor.recordMetric({
        name: 'single-p',
        value: 42,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      const p99 = performanceMonitor.getPercentile('single-p', 99);
      
      expect(p99).toBe(42);
    });
  });

  describe('generateReport', () => {
    it('generates empty report when no metrics exist', () => {
      const report = performanceMonitor.generateReport();
      
      expect(report.summary).toEqual({});
      expect(report.issues).toEqual([]);
    });

    it('includes summary statistics for recorded metrics', () => {
      const values = [100, 150, 200, 250, 300];
      values.forEach(value => {
        performanceMonitor.recordMetric({
          name: 'report-test',
          value,
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
      
      const report = performanceMonitor.generateReport();
      
      expect(report.summary['report-test']).toBeDefined();
      expect(report.summary['report-test'].avg).toBe(200);
      expect(report.summary['report-test'].p50).toBeGreaterThan(0);
    });

    it('identifies performance issues based on benchmarks', () => {
      performanceMonitor.recordMetric({
        name: 'settings.panel.load',
        value: 600,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      const report = performanceMonitor.generateReport();
      
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.issues[0].severity).toBe('critical');
    });

    it('reports warning severity for values above warning threshold', () => {
      performanceMonitor.recordMetric({
        name: 'settings.panel.load',
        value: 350,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      const report = performanceMonitor.generateReport();
      
      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.issues[0].severity).toBe('warning');
    });
  });

  describe('clear', () => {
    it('removes all stored metrics', () => {
      performanceMonitor.recordMetric({
        name: 'clear-test',
        value: 100,
        unit: 'ms',
        timestamp: Date.now(),
      });
      
      performanceMonitor.clear();
      const metrics = performanceMonitor.getMetrics('clear-test');
      
      expect(metrics.length).toBe(0);
    });
  });
});

describe('PERFORMANCE_BENCHMARKS', () => {
  it('defines benchmarks for settings operations', () => {
    expect(PERFORMANCE_BENCHMARKS['settings.panel.load']).toBeDefined();
    expect(PERFORMANCE_BENCHMARKS['settings.panel.load'].target).toBe(200);
  });

  it('has warning threshold higher than target', () => {
    Object.values(PERFORMANCE_BENCHMARKS).forEach(benchmark => {
      expect(benchmark.warning).toBeGreaterThan(benchmark.target);
    });
  });

  it('has critical threshold higher than warning', () => {
    Object.values(PERFORMANCE_BENCHMARKS).forEach(benchmark => {
      expect(benchmark.critical).toBeGreaterThan(benchmark.warning);
    });
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    expect(fn).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels previous calls when invoked multiple times', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced();
    debounced();
    
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('executes immediately with leading option', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100, { leading: true });
    
    debounced();
    expect(fn).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced.cancel();
    
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('can be flushed immediately', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced.flush();
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxWait option', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100, { maxWait: 200 });
    
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(100);
    
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments correctly', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);
    
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('New Performance Metrics', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  describe('measureThroughput', () => {
    it('calculates actions per second correctly', () => {
      performanceMonitor.measureThroughput('test-component', 100, 1000);
      
      const metrics = performanceMonitor.getMetrics('throughput.test-component');
      
      expect(metrics.length).toBe(1);
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].unit).toBe('count');
    });

    it('stores action count and duration in metadata', () => {
      performanceMonitor.measureThroughput('button-clicks', 50, 500);
      
      const metrics = performanceMonitor.getMetrics('throughput.button-clicks');
      
      expect(metrics[0].metadata?.actionCount).toBe(50);
      expect(metrics[0].metadata?.duration).toBe(500);
    });

    it('handles high throughput correctly', () => {
      performanceMonitor.measureThroughput('rapid-actions', 1000, 100);
      
      const metrics = performanceMonitor.getMetrics('throughput.rapid-actions');
      
      expect(metrics[0].value).toBe(10000);
    });
  });

  describe('recordOperation', () => {
    it('records successful operations', () => {
      performanceMonitor.recordOperation('api-call', true, 150);
      
      const metrics = performanceMonitor.getMetrics('api-call');
      
      expect(metrics.length).toBe(1);
      expect(metrics[0].metadata?.success).toBe(true);
      expect(metrics[0].metadata?.error).toBe(false);
    });

    it('records failed operations', () => {
      performanceMonitor.recordOperation('api-call', false, 200);
      
      const metrics = performanceMonitor.getMetrics('api-call');
      
      expect(metrics[0].metadata?.success).toBe(false);
      expect(metrics[0].metadata?.error).toBe(true);
    });

    it('handles operations without duration', () => {
      performanceMonitor.recordOperation('validation', true);
      
      const metrics = performanceMonitor.getMetrics('validation');
      
      expect(metrics[0].value).toBe(0);
    });
  });

  describe('calculateErrorRate', () => {
    it('returns 0 when no metrics exist', () => {
      const errorRate = performanceMonitor.calculateErrorRate('non-existent');
      
      expect(errorRate).toBe(0);
    });

    it('calculates error rate correctly', () => {
      performanceMonitor.recordOperation('test-op', true);
      performanceMonitor.recordOperation('test-op', true);
      performanceMonitor.recordOperation('test-op', false);
      performanceMonitor.recordOperation('test-op', false);
      
      const errorRate = performanceMonitor.calculateErrorRate('test-op');
      
      expect(errorRate).toBe(50);
    });

    it('returns 0 for all successful operations', () => {
      performanceMonitor.recordOperation('success-op', true);
      performanceMonitor.recordOperation('success-op', true);
      
      const errorRate = performanceMonitor.calculateErrorRate('success-op');
      
      expect(errorRate).toBe(0);
    });

    it('returns 100 for all failed operations', () => {
      performanceMonitor.recordOperation('fail-op', false);
      performanceMonitor.recordOperation('fail-op', false);
      
      const errorRate = performanceMonitor.calculateErrorRate('fail-op');
      
      expect(errorRate).toBe(100);
    });

    it('filters by time window', () => {
      const oldTimestamp = Date.now() - 120000;
      
      performanceMonitor.recordMetric({
        name: 'time-test',
        value: 100,
        unit: 'ms',
        timestamp: oldTimestamp,
        metadata: { error: true },
      });
      
      performanceMonitor.recordOperation('time-test', true);
      
      const errorRate = performanceMonitor.calculateErrorRate('time-test', 60000);
      
      expect(errorRate).toBe(0);
    });
  });

  describe('Web Vitals Benchmarks', () => {
    it('defines INP benchmark', () => {
      expect(PERFORMANCE_BENCHMARKS['web-vitals.inp']).toBeDefined();
      expect(PERFORMANCE_BENCHMARKS['web-vitals.inp'].target).toBe(200);
      expect(PERFORMANCE_BENCHMARKS['web-vitals.inp'].critical).toBe(500);
    });

    it('defines TBT benchmark', () => {
      expect(PERFORMANCE_BENCHMARKS['web-vitals.tbt']).toBeDefined();
      expect(PERFORMANCE_BENCHMARKS['web-vitals.tbt'].target).toBe(200);
      expect(PERFORMANCE_BENCHMARKS['web-vitals.tbt'].critical).toBe(600);
    });

    it('defines FCP benchmark', () => {
      expect(PERFORMANCE_BENCHMARKS['web-vitals.fcp']).toBeDefined();
      expect(PERFORMANCE_BENCHMARKS['web-vitals.fcp'].target).toBe(1800);
      expect(PERFORMANCE_BENCHMARKS['web-vitals.fcp'].critical).toBe(3000);
    });

    it('defines LCP benchmark', () => {
      expect(PERFORMANCE_BENCHMARKS['web-vitals.lcp']).toBeDefined();
      expect(PERFORMANCE_BENCHMARKS['web-vitals.lcp'].target).toBe(2500);
      expect(PERFORMANCE_BENCHMARKS['web-vitals.lcp'].critical).toBe(4000);
    });
  });
});
