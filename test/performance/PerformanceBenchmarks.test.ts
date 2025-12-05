/**
 * Performance Benchmarks Tests
 * 
 * Tests system performance metrics, response times, throughput,
 * and resource utilization under normal operating conditions.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../lib/agent-fabric/agents/ExpansionAgent';
import { IntegrityAgent } from '../../lib/agent-fabric/agents/IntegrityAgent';
import { RealizationAgent } from '../../lib/agent-fabric/agents/RealizationAgent';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const runPerf = process.env.RUN_PERF_TESTS === 'true';
const describeMaybe = runIntegration && runPerf ? describe : describe.skip;

interface PerformanceMetrics {
  duration: number;
  memory: number;
  cpu: number;
  throughput: number;
}

const measurePerformance = async (fn: () => Promise<any>): Promise<PerformanceMetrics> => {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

  await fn();

  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

  return {
    duration: endTime - startTime,
    memory: endMemory - startMemory,
    cpu: 0,
    throughput: 0,
  };
};

describeMaybe('PerformanceBenchmarks - Agent Invocation', () => {
  it('opportunity agent invocation meets performance SLA', async () => {
    const agent = new OpportunityAgent({} as any);

    const metrics = await measurePerformance(async () => {
      await agent.invoke({
        customer_context: 'Performance benchmark test',
      });
    });

    expect(metrics.duration).toBeLessThan(2000);
    expect(metrics.memory).toBeLessThan(10 * 1024 * 1024);
  });

  it('target agent invocation meets performance SLA', async () => {
    const agent = new TargetAgent({} as any);

    const metrics = await measurePerformance(async () => {
      await agent.invoke({
        opportunity_id: 'opp-1',
      });
    });

    expect(metrics.duration).toBeLessThan(2500);
    expect(metrics.memory).toBeLessThan(15 * 1024 * 1024);
  });

  it('expansion agent invocation meets performance SLA', async () => {
    const agent = new ExpansionAgent({} as any);

    const metrics = await measurePerformance(async () => {
      await agent.invoke({
        value_tree_id: 'tree-1',
      });
    });

    expect(metrics.duration).toBeLessThan(2000);
    expect(metrics.memory).toBeLessThan(12 * 1024 * 1024);
  });

  it('integrity agent invocation meets performance SLA', async () => {
    const agent = new IntegrityAgent({} as any);

    const metrics = await measurePerformance(async () => {
      await agent.invoke({
        roi_model_id: 'roi-1',
      });
    });

    expect(metrics.duration).toBeLessThan(1500);
    expect(metrics.memory).toBeLessThan(8 * 1024 * 1024);
  });

  it('realization agent invocation meets performance SLA', async () => {
    const agent = new RealizationAgent({} as any);

    const metrics = await measurePerformance(async () => {
      await agent.invoke({
        value_commit_id: 'commit-1',
      });
    });

    expect(metrics.duration).toBeLessThan(1800);
    expect(metrics.memory).toBeLessThan(10 * 1024 * 1024);
  });
});

describeMaybe('PerformanceBenchmarks - Throughput', () => {
  it('handles 100 sequential requests within time budget', async () => {
    const agent = new OpportunityAgent({} as any);
    const requestCount = 100;

    const startTime = performance.now();

    for (let i = 0; i < requestCount; i++) {
      await agent.invoke({
        customer_context: `Request ${i}`,
      });
    }

    const duration = performance.now() - startTime;
    const avgDuration = duration / requestCount;

    expect(duration).toBeLessThan(60000);
    expect(avgDuration).toBeLessThan(600);
  });

  it('achieves target throughput for concurrent requests', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentCount = 50;

    const startTime = performance.now();

    await Promise.all(
      Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({
          customer_context: `Concurrent ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const throughput = (concurrentCount / duration) * 1000;

    expect(throughput).toBeGreaterThan(5);
  });

  it('maintains consistent throughput over time', async () => {
    const agent = new OpportunityAgent({} as any);
    const batchSize = 20;
    const batchCount = 5;

    const throughputs: number[] = [];

    for (let batch = 0; batch < batchCount; batch++) {
      const startTime = performance.now();

      await Promise.all(
        Array.from({ length: batchSize }, (_, i) =>
          agent.invoke({
            customer_context: `Batch ${batch} Request ${i}`,
          })
        )
      );

      const duration = performance.now() - startTime;
      const throughput = (batchSize / duration) * 1000;
      throughputs.push(throughput);
    }

    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const variance = throughputs.reduce((sum, t) => sum + Math.pow(t - avgThroughput, 2), 0) / throughputs.length;
    const stdDev = Math.sqrt(variance);

    expect(stdDev / avgThroughput).toBeLessThan(0.3);
  });
});

describeMaybe('PerformanceBenchmarks - Response Time', () => {
  it('p50 response time meets SLA', async () => {
    const agent = new OpportunityAgent({} as any);
    const sampleSize = 100;
    const durations: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const startTime = performance.now();
      await agent.invoke({
        customer_context: `Sample ${i}`,
      });
      durations.push(performance.now() - startTime);
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(sampleSize * 0.5)];

    expect(p50).toBeLessThan(1500);
  });

  it('p95 response time meets SLA', async () => {
    const agent = new OpportunityAgent({} as any);
    const sampleSize = 100;
    const durations: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const startTime = performance.now();
      await agent.invoke({
        customer_context: `Sample ${i}`,
      });
      durations.push(performance.now() - startTime);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(sampleSize * 0.95)];

    expect(p95).toBeLessThan(3000);
  });

  it('p99 response time meets SLA', async () => {
    const agent = new OpportunityAgent({} as any);
    const sampleSize = 100;
    const durations: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const startTime = performance.now();
      await agent.invoke({
        customer_context: `Sample ${i}`,
      });
      durations.push(performance.now() - startTime);
    }

    durations.sort((a, b) => a - b);
    const p99 = durations[Math.floor(sampleSize * 0.99)];

    expect(p99).toBeLessThan(5000);
  });

  it('max response time stays within acceptable bounds', async () => {
    const agent = new OpportunityAgent({} as any);
    const sampleSize = 50;
    const durations: number[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const startTime = performance.now();
      await agent.invoke({
        customer_context: `Sample ${i}`,
      });
      durations.push(performance.now() - startTime);
    }

    const maxDuration = Math.max(...durations);

    expect(maxDuration).toBeLessThan(10000);
  });
});

describeMaybe('PerformanceBenchmarks - Resource Utilization', () => {
  it('memory usage stays within limits', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 100;

    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        customer_context: `Memory test ${i}`,
      });
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });

  it('no memory leaks detected over extended operation', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 50;
    const measurements: number[] = [];

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        customer_context: `Leak test ${i}`,
      });

      if (i % 10 === 0) {
        const memory = (performance as any).memory?.usedJSHeapSize || 0;
        measurements.push(memory);
      }
    }

    const firstHalf = measurements.slice(0, Math.floor(measurements.length / 2));
    const secondHalf = measurements.slice(Math.floor(measurements.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const memoryGrowth = (avgSecond - avgFirst) / avgFirst;

    expect(memoryGrowth).toBeLessThan(0.5);
  });

  it('CPU usage remains efficient', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();
    const startCpu = process.cpuUsage?.() || { user: 0, system: 0 };

    await agent.invoke({
      customer_context: 'CPU test',
    });

    const endTime = performance.now();
    const endCpu = process.cpuUsage?.(startCpu) || { user: 0, system: 0 };

    const duration = endTime - startTime;
    const cpuTime = (endCpu.user + endCpu.system) / 1000;
    const cpuUtilization = cpuTime / duration;

    expect(cpuUtilization).toBeLessThan(0.8);
  });
});

describeMaybe('PerformanceBenchmarks - Database Operations', () => {
  it('database query performance meets SLA', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    await agent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(500);
  });

  it('bulk insert performance is acceptable', async () => {
    const agent = new OpportunityAgent({} as any);
    const recordCount = 100;

    const startTime = performance.now();

    await agent.invoke({
      action: 'bulk_create',
      records: Array.from({ length: recordCount }, (_, i) => ({
        customer_context: `Bulk ${i}`,
      })),
    });

    const duration = performance.now() - startTime;
    const avgDuration = duration / recordCount;

    expect(avgDuration).toBeLessThan(50);
  });

  it('complex query performance is optimized', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    await agent.invoke({
      action: 'complex_query',
      filters: {
        date_range: { start: '2024-01-01', end: '2024-12-31' },
        status: ['active', 'pending'],
        tags: ['automation', 'efficiency'],
      },
      sort: { field: 'created_at', order: 'desc' },
      limit: 100,
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(1000);
  });

  it('connection pool efficiency is maintained', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentQueries = 20;

    const startTime = performance.now();

    await Promise.all(
      Array.from({ length: concurrentQueries }, (_, i) =>
        agent.invoke({
          action: 'get',
          opportunity_id: `opp-${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const avgDuration = duration / concurrentQueries;

    expect(avgDuration).toBeLessThan(200);
  });
});

describeMaybe('PerformanceBenchmarks - Caching', () => {
  it('cache hit improves response time', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime1 = performance.now();
    await agent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: false,
    });
    const duration1 = performance.now() - startTime1;

    const startTime2 = performance.now();
    await agent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: true,
    });
    const duration2 = performance.now() - startTime2;

    const startTime3 = performance.now();
    await agent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: true,
    });
    const duration3 = performance.now() - startTime3;

    expect(duration3).toBeLessThan(duration1 * 0.5);
  });

  it('cache invalidation performance is acceptable', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    await agent.invoke({
      action: 'invalidate_cache',
      pattern: 'opp-*',
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  it('cache memory overhead is reasonable', async () => {
    const agent = new OpportunityAgent({} as any);

    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < 100; i++) {
      await agent.invoke({
        action: 'get',
        opportunity_id: `opp-${i}`,
        use_cache: true,
      });
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const cacheMemory = finalMemory - initialMemory;

    expect(cacheMemory).toBeLessThan(50 * 1024 * 1024);
  });
});

describeMaybe('PerformanceBenchmarks - Network Operations', () => {
  it('API request latency is acceptable', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    await agent.invoke({
      action: 'external_api_call',
      endpoint: '/api/test',
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(2000);
  });

  it('handles network timeouts gracefully', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    const result = await agent.invoke({
      action: 'external_api_call',
      endpoint: '/api/slow',
      timeout: 1000,
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(1500);
    expect(result.success).toBe(false);
  });

  it('retry mechanism performance is efficient', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    await agent.invoke({
      action: 'external_api_call',
      endpoint: '/api/flaky',
      retry: {
        max_attempts: 3,
        delay: 100,
      },
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(5000);
  });
});

describeMaybe('PerformanceBenchmarks - Batch Operations', () => {
  it('batch processing performance scales linearly', async () => {
    const agent = new OpportunityAgent({} as any);

    const batchSizes = [10, 20, 40];
    const durations: number[] = [];

    for (const size of batchSizes) {
      const startTime = performance.now();

      await agent.invoke({
        action: 'batch_process',
        items: Array.from({ length: size }, (_, i) => ({
          customer_context: `Batch item ${i}`,
        })),
      });

      durations.push(performance.now() - startTime);
    }

    const ratio1 = durations[1] / durations[0];
    const ratio2 = durations[2] / durations[1];

    expect(ratio1).toBeGreaterThan(1.5);
    expect(ratio1).toBeLessThan(2.5);
    expect(ratio2).toBeGreaterThan(1.5);
    expect(ratio2).toBeLessThan(2.5);
  });

  it('parallel batch processing improves throughput', async () => {
    const agent = new OpportunityAgent({} as any);
    const batchSize = 50;

    const startTimeSequential = performance.now();
    for (let i = 0; i < batchSize; i++) {
      await agent.invoke({
        customer_context: `Sequential ${i}`,
      });
    }
    const durationSequential = performance.now() - startTimeSequential;

    const startTimeParallel = performance.now();
    await Promise.all(
      Array.from({ length: batchSize }, (_, i) =>
        agent.invoke({
          customer_context: `Parallel ${i}`,
        })
      )
    );
    const durationParallel = performance.now() - startTimeParallel;

    expect(durationParallel).toBeLessThan(durationSequential * 0.5);
  });
});

describeMaybe('PerformanceBenchmarks - Optimization Validation', () => {
  it('validates query optimization effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTimeUnoptimized = performance.now();
    await agent.invoke({
      action: 'query',
      optimize: false,
    });
    const durationUnoptimized = performance.now() - startTimeUnoptimized;

    const startTimeOptimized = performance.now();
    await agent.invoke({
      action: 'query',
      optimize: true,
    });
    const durationOptimized = performance.now() - startTimeOptimized;

    expect(durationOptimized).toBeLessThan(durationUnoptimized * 0.7);
  });

  it('validates index usage improves performance', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    await agent.invoke({
      action: 'indexed_query',
      field: 'opportunity_id',
      value: 'opp-1',
    });

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100);
  });

  it('validates compression reduces payload size', async () => {
    const agent = new OpportunityAgent({} as any);

    const result = await agent.invoke({
      action: 'get_large_dataset',
      compress: true,
    });

    expect(result.compressed_size).toBeLessThan(result.original_size * 0.5);
  });
});

describeMaybe('PerformanceBenchmarks - Memory Leak Detection', () => {
  it('detects memory leaks in repeated operations', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 100;
    const measurements: number[] = [];

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        customer_context: `Leak detection ${i}`,
      });

      if (i % 10 === 0) {
        if (global.gc) {
          global.gc();
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        const memory = (performance as any).memory?.usedJSHeapSize || 0;
        measurements.push(memory);
      }
    }

    const slope = calculateMemorySlope(measurements);
    const leakDetected = slope > 1024 * 1024;

    expect(leakDetected).toBe(false);
  });

  it('detects event listener leaks', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 50;

    const initialListeners = getEventListenerCount();

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        action: 'subscribe_events',
        event_type: 'test',
      });
    }

    const finalListeners = getEventListenerCount();
    const listenerGrowth = finalListeners - initialListeners;

    expect(listenerGrowth).toBeLessThan(iterations * 0.2);
  });

  it('detects closure memory leaks', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 100;

    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        action: 'create_closure',
        data_size: 1024 * 1024,
      });
    }

    if (global.gc) {
      global.gc();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  it('detects timer leaks', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 50;

    const initialTimers = getActiveTimerCount();

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        action: 'create_timer',
        duration: 1000,
      });
    }

    const finalTimers = getActiveTimerCount();
    const timerGrowth = finalTimers - initialTimers;

    expect(timerGrowth).toBeLessThan(iterations * 0.2);
  });

  it('validates proper cleanup on error', async () => {
    const agent = new OpportunityAgent({} as any);

    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < 50; i++) {
      try {
        await agent.invoke({
          customer_context: `Error cleanup ${i}`,
          force_error: true,
        });
      } catch (error) {
        // Expected
      }
    }

    if (global.gc) {
      global.gc();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
  });
});

describeMaybe('PerformanceBenchmarks - Memory Profiling', () => {
  it('profiles memory allocation patterns', async () => {
    const agent = new OpportunityAgent({} as any);
    const allocations: number[] = [];

    for (let i = 0; i < 10; i++) {
      const before = (performance as any).memory?.usedJSHeapSize || 0;

      await agent.invoke({
        customer_context: `Allocation profile ${i}`,
      });

      const after = (performance as any).memory?.usedJSHeapSize || 0;
      allocations.push(after - before);
    }

    const avgAllocation = allocations.reduce((a, b) => a + b, 0) / allocations.length;
    const variance = allocations.reduce((sum, a) => sum + Math.pow(a - avgAllocation, 2), 0) / allocations.length;
    const stdDev = Math.sqrt(variance);

    expect(stdDev / avgAllocation).toBeLessThan(0.5);
  });

  it('identifies memory hotspots', async () => {
    const agent = new OpportunityAgent({} as any);

    const result = await agent.invoke({
      action: 'profile_memory',
      track_allocations: true,
    });

    expect(result.memory_profile).toBeDefined();
    expect(result.memory_profile.hotspots).toBeDefined();
    expect(result.memory_profile.hotspots.length).toBeGreaterThan(0);
  });

  it('tracks heap size over time', async () => {
    const agent = new OpportunityAgent({} as any);
    const samples: number[] = [];

    for (let i = 0; i < 20; i++) {
      await agent.invoke({
        customer_context: `Heap tracking ${i}`,
      });

      const heapSize = (performance as any).memory?.usedJSHeapSize || 0;
      samples.push(heapSize);

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const maxHeap = Math.max(...samples);
    const minHeap = Math.min(...samples);
    const heapVariation = (maxHeap - minHeap) / minHeap;

    expect(heapVariation).toBeLessThan(2.0);
  });

  it('validates garbage collection effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const beforeGC = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < 50; i++) {
      await agent.invoke({
        customer_context: `GC test ${i}`,
      });
    }

    const beforeManualGC = (performance as any).memory?.usedJSHeapSize || 0;

    if (global.gc) {
      global.gc();
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    const afterGC = (performance as any).memory?.usedJSHeapSize || 0;

    const gcEffectiveness = (beforeManualGC - afterGC) / beforeManualGC;

    expect(gcEffectiveness).toBeGreaterThan(0.1);
  });
});

// Helper functions
function calculateMemorySlope(measurements: number[]): number {
  if (measurements.length < 2) return 0;

  const n = measurements.length;
  const sumX = measurements.reduce((sum, _, i) => sum + i, 0);
  const sumY = measurements.reduce((sum, val) => sum + val, 0);
  const sumXY = measurements.reduce((sum, val, i) => sum + i * val, 0);
  const sumX2 = measurements.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

function getEventListenerCount(): number {
  return (process as any).listenerCount?.('*') || 0;
}

function getActiveTimerCount(): number {
  return (process as any)._getActiveHandles?.().length || 0;
}
