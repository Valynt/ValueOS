/**
 * Stress Testing Tests
 * 
 * Tests system behavior at and beyond capacity limits,
 * identifies breaking points, and validates graceful degradation.
 */

import { describe, expect, it } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';

describe('StressTesting - Capacity Limits', () => {
  it('identifies maximum concurrent request capacity', async () => {
    const agent = new OpportunityAgent({} as any);
    const maxConcurrent = 1000;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: maxConcurrent }, (_, i) =>
        agent.invoke({
          customer_context: `Capacity test ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / maxConcurrent;

    expect(successRate).toBeGreaterThan(0.70);
    expect(duration).toBeLessThan(120000);
  });

  it('handles requests beyond capacity gracefully', async () => {
    const agent = new OpportunityAgent({} as any);
    const beyondCapacity = 2000;

    const results = await Promise.allSettled(
      Array.from({ length: beyondCapacity }, (_, i) =>
        agent.invoke({
          customer_context: `Beyond capacity ${i}`,
        })
      )
    );

    const rejectedCount = results.filter((r) => r.status === 'rejected').length;
    const rejectedRate = rejectedCount / beyondCapacity;

    expect(rejectedRate).toBeLessThan(0.50);
  });

  it('system remains responsive under extreme load', async () => {
    const agent = new OpportunityAgent({} as any);
    const extremeLoad = 1500;

    const heavyLoadPromise = Promise.allSettled(
      Array.from({ length: extremeLoad }, (_, i) =>
        agent.invoke({
          customer_context: `Extreme load ${i}`,
        })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const startTime = performance.now();
    const healthCheck = await agent.invoke({
      action: 'health_check',
    });
    const healthCheckDuration = performance.now() - startTime;

    await heavyLoadPromise;

    expect(healthCheck.success).toBe(true);
    expect(healthCheckDuration).toBeLessThan(5000);
  });
});

describe('StressTesting - Memory Stress', () => {
  it('handles large payload processing', async () => {
    const agent = new OpportunityAgent({} as any);
    const largePayloadSize = 10 * 1024 * 1024;

    const largePayload = {
      customer_context: 'Large payload test',
      data: 'x'.repeat(largePayloadSize),
    };

    const startTime = performance.now();
    const result = await agent.invoke(largePayload);
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000);
  });

  it('handles multiple large payloads concurrently', async () => {
    const agent = new OpportunityAgent({} as any);
    const payloadCount = 20;
    const payloadSize = 5 * 1024 * 1024;

    const results = await Promise.allSettled(
      Array.from({ length: payloadCount }, (_, i) => ({
        customer_context: `Large payload ${i}`,
        data: 'x'.repeat(payloadSize),
      })).map((payload) => agent.invoke(payload))
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / payloadCount;

    expect(successRate).toBeGreaterThan(0.70);
  });

  it('recovers from memory pressure', async () => {
    const agent = new OpportunityAgent({} as any);

    const memoryStressCount = 50;
    await Promise.allSettled(
      Array.from({ length: memoryStressCount }, (_, i) =>
        agent.invoke({
          customer_context: `Memory stress ${i}`,
          data: 'x'.repeat(1024 * 1024),
        })
      )
    );

    if (global.gc) {
      global.gc();
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const recoveryResult = await agent.invoke({
      customer_context: 'Recovery test',
    });

    expect(recoveryResult.success).toBe(true);
  });
});

describe('StressTesting - CPU Stress', () => {
  it('handles CPU-intensive operations', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    const result = await agent.invoke({
      action: 'cpu_intensive',
      iterations: 1000000,
    });

    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(30000);
  });

  it('handles multiple CPU-intensive operations concurrently', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentCount = 10;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({
          action: 'cpu_intensive',
          iterations: 500000,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / concurrentCount;

    expect(successRate).toBeGreaterThan(0.80);
    expect(duration).toBeLessThan(60000);
  });
});

describe('StressTesting - Database Stress', () => {
  it('handles database connection exhaustion', async () => {
    const agent = new OpportunityAgent({} as any);
    const connectionCount = 200;

    const results = await Promise.allSettled(
      Array.from({ length: connectionCount }, (_, i) =>
        agent.invoke({
          action: 'database_query',
          query_id: `query-${i}`,
        })
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / connectionCount;

    expect(successRate).toBeGreaterThan(0.75);
  });

  it('handles large result set processing', async () => {
    const agent = new OpportunityAgent({} as any);

    const startTime = performance.now();

    const result = await agent.invoke({
      action: 'large_query',
      limit: 10000,
    });

    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(15000);
  });

  it('handles transaction deadlock scenarios', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentTransactions = 50;

    const results = await Promise.allSettled(
      Array.from({ length: concurrentTransactions }, (_, i) =>
        agent.invoke({
          action: 'transaction',
          resource_a: `res-${i % 10}`,
          resource_b: `res-${(i + 1) % 10}`,
        })
      )
    );

    const deadlocks = results.filter(
      (r) => r.status === 'rejected' && r.reason?.includes('deadlock')
    );

    expect(deadlocks.length).toBeLessThan(concurrentTransactions * 0.2);
  });
});

describe('StressTesting - Network Stress', () => {
  it('handles network latency spikes', async () => {
    const agent = new OpportunityAgent({} as any);

    const result = await agent.invoke({
      action: 'external_call',
      simulate_latency: 5000,
      timeout: 10000,
    });

    expect(result.success).toBe(true);
  });

  it('handles network packet loss', async () => {
    const agent = new OpportunityAgent({} as any);
    const requestCount = 50;

    const results = await Promise.allSettled(
      Array.from({ length: requestCount }, (_, i) =>
        agent.invoke({
          action: 'external_call',
          simulate_packet_loss: 0.1,
        })
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / requestCount;

    expect(successRate).toBeGreaterThan(0.70);
  });

  it('handles network partition scenarios', async () => {
    const agent = new OpportunityAgent({} as any);

    const result = await agent.invoke({
      action: 'external_call',
      simulate_partition: true,
      fallback: true,
    });

    expect(result.success).toBe(true);
    expect(result.used_fallback).toBe(true);
  });
});

describe('StressTesting - Cascading Failures', () => {
  it('prevents cascading failures across services', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        opportunityAgent.invoke({
          customer_context: `Cascade test ${i}`,
          force_errors: true,
        })
      )
    );

    const targetResult = await targetAgent.invoke({
      opportunity_id: 'opp-1',
    });

    expect(targetResult.success).toBe(true);
  });

  it('circuit breaker prevents system overload', async () => {
    const agent = new OpportunityAgent({} as any);

    const errorCount = 50;
    await Promise.allSettled(
      Array.from({ length: errorCount }, (_, i) =>
        agent.invoke({
          customer_context: `Error ${i}`,
          force_errors: true,
        })
      )
    );

    const result = await agent.invoke({
      customer_context: 'After errors',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('circuit breaker');
  });

  it('bulkhead isolation limits failure impact', async () => {
    const agent = new OpportunityAgent({} as any);

    const criticalPromise = agent.invoke({
      action: 'critical_operation',
      priority: 'high',
    });

    await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        agent.invoke({
          action: 'non_critical_operation',
          force_slow: true,
        })
      )
    );

    const criticalResult = await criticalPromise;

    expect(criticalResult.success).toBe(true);
  });
});

describe('StressTesting - Recovery and Resilience', () => {
  it('recovers from complete system overload', async () => {
    const agent = new OpportunityAgent({} as any);

    await Promise.allSettled(
      Array.from({ length: 500 }, (_, i) =>
        agent.invoke({
          customer_context: `Overload ${i}`,
        })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const recoveryResults = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        agent.invoke({
          customer_context: `Recovery ${i}`,
        })
      )
    );

    const successCount = recoveryResults.filter((r) => r.success).length;
    const successRate = successCount / 10;

    expect(successRate).toBeGreaterThan(0.80);
  });

  it('maintains data consistency during stress', async () => {
    const agent = new OpportunityAgent({} as any);

    const createResult = await agent.invoke({
      action: 'create',
      customer_context: 'Consistency test',
    });

    await Promise.allSettled(
      Array.from({ length: 200 }, (_, i) =>
        agent.invoke({
          customer_context: `Stress ${i}`,
        })
      )
    );

    const retrieveResult = await agent.invoke({
      action: 'get',
      opportunity_id: createResult.data.opportunity_id,
    });

    expect(retrieveResult.success).toBe(true);
    expect(retrieveResult.data.opportunity_id).toBe(createResult.data.opportunity_id);
  });

  it('graceful degradation under extreme stress', async () => {
    const agent = new OpportunityAgent({} as any);

    const results = await Promise.allSettled(
      Array.from({ length: 1000 }, (_, i) =>
        agent.invoke({
          customer_context: `Degradation test ${i}`,
        })
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const gracefulFailures = results.filter(
      (r) => r.status === 'rejected' && r.reason?.includes('rate limit')
    ).length;

    expect(successCount + gracefulFailures).toBeGreaterThan(900);
  });
});

describe('StressTesting - Resource Exhaustion', () => {
  it('handles file descriptor exhaustion', async () => {
    const agent = new OpportunityAgent({} as any);
    const fileOperations = 500;

    const results = await Promise.allSettled(
      Array.from({ length: fileOperations }, (_, i) =>
        agent.invoke({
          action: 'file_operation',
          file_id: `file-${i}`,
        })
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / fileOperations;

    expect(successRate).toBeGreaterThan(0.70);
  });

  it('handles thread pool exhaustion', async () => {
    const agent = new OpportunityAgent({} as any);
    const threadOperations = 200;

    const results = await Promise.allSettled(
      Array.from({ length: threadOperations }, (_, i) =>
        agent.invoke({
          action: 'thread_operation',
          duration: 1000,
        })
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / threadOperations;

    expect(successRate).toBeGreaterThan(0.75);
  });

  it('handles disk space exhaustion gracefully', async () => {
    const agent = new OpportunityAgent({} as any);

    const result = await agent.invoke({
      action: 'large_write',
      size: 1024 * 1024 * 1024,
      simulate_disk_full: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('disk');
  });
});

describe('StressTesting - Time-based Stress', () => {
  it('maintains performance over extended duration', async () => {
    const agent = new OpportunityAgent({} as any);
    const duration = 60000;
    const interval = 500;

    const startTime = Date.now();
    const durations: number[] = [];

    while (Date.now() - startTime < duration) {
      const reqStart = performance.now();
      await agent.invoke({
        customer_context: 'Extended test',
      });
      durations.push(performance.now() - reqStart);

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    const firstQuarter = durations.slice(0, Math.floor(durations.length / 4));
    const lastQuarter = durations.slice(-Math.floor(durations.length / 4));

    const avgFirst = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
    const avgLast = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

    const degradation = (avgLast - avgFirst) / avgFirst;

    expect(degradation).toBeLessThan(0.5);
  });

  it('handles rapid request rate changes', async () => {
    const agent = new OpportunityAgent({} as any);

    const lowRate = 5;
    await Promise.all(
      Array.from({ length: lowRate }, (_, i) =>
        agent.invoke({
          customer_context: `Low rate ${i}`,
        })
      )
    );

    const highRate = 100;
    const results = await Promise.allSettled(
      Array.from({ length: highRate }, (_, i) =>
        agent.invoke({
          customer_context: `High rate ${i}`,
        })
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / highRate;

    expect(successRate).toBeGreaterThan(0.75);
  });
});

describe('StressTesting - Scalability', () => {
  it('validates linear scalability with data volume', async () => {
    const agent = new OpportunityAgent({} as any);

    const volumes = [100, 200, 400];
    const durations: number[] = [];

    for (const volume of volumes) {
      const startTime = performance.now();

      await agent.invoke({
        action: 'process_batch',
        volume,
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

  it('validates horizontal scaling effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const singleNodeThroughput = await measureThroughput(agent, 1, 100);
    const dualNodeThroughput = await measureThroughput(agent, 2, 200);
    const quadNodeThroughput = await measureThroughput(agent, 4, 400);

    expect(dualNodeThroughput).toBeGreaterThan(singleNodeThroughput * 1.5);
    expect(quadNodeThroughput).toBeGreaterThan(dualNodeThroughput * 1.5);
  });

  it('validates vertical scaling effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const lowResourceDuration = await measureDuration(agent, {
      cpu: 1,
      memory: 512,
    });

    const highResourceDuration = await measureDuration(agent, {
      cpu: 4,
      memory: 2048,
    });

    expect(highResourceDuration).toBeLessThan(lowResourceDuration * 0.5);
  });

  it('identifies scalability bottlenecks', async () => {
    const agent = new OpportunityAgent({} as any);

    const loads = [50, 100, 200, 400, 800];
    const throughputs: number[] = [];

    for (const load of loads) {
      const startTime = performance.now();

      await Promise.allSettled(
        Array.from({ length: load }, (_, i) =>
          agent.invoke({
            customer_context: `Bottleneck test ${i}`,
          })
        )
      );

      const duration = performance.now() - startTime;
      const throughput = (load / duration) * 1000;
      throughputs.push(throughput);
    }

    const bottleneckDetected = throughputs.some((t, i) => {
      if (i === 0) return false;
      const growthRate = t / throughputs[i - 1];
      return growthRate < 1.2;
    });

    expect(bottleneckDetected).toBe(true);
  });
});

describe('StressTesting - Resource Optimization', () => {
  it('validates connection pooling efficiency', async () => {
    const agent = new OpportunityAgent({} as any);

    const withoutPooling = await measureDuration(agent, {
      use_connection_pool: false,
      concurrent_requests: 50,
    });

    const withPooling = await measureDuration(agent, {
      use_connection_pool: true,
      concurrent_requests: 50,
    });

    expect(withPooling).toBeLessThan(withoutPooling * 0.7);
  });

  it('validates query optimization impact', async () => {
    const agent = new OpportunityAgent({} as any);

    const unoptimizedDuration = await measureDuration(agent, {
      action: 'complex_query',
      optimize: false,
    });

    const optimizedDuration = await measureDuration(agent, {
      action: 'complex_query',
      optimize: true,
    });

    expect(optimizedDuration).toBeLessThan(unoptimizedDuration * 0.6);
  });

  it('validates caching strategy effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const noCacheDuration = await measureDuration(agent, {
      action: 'get',
      use_cache: false,
      iterations: 100,
    });

    const withCacheDuration = await measureDuration(agent, {
      action: 'get',
      use_cache: true,
      iterations: 100,
    });

    expect(withCacheDuration).toBeLessThan(noCacheDuration * 0.5);
  });

  it('validates batch processing efficiency', async () => {
    const agent = new OpportunityAgent({} as any);

    const individualDuration = await measureDuration(agent, {
      action: 'process_individual',
      count: 100,
    });

    const batchDuration = await measureDuration(agent, {
      action: 'process_batch',
      count: 100,
      batch_size: 10,
    });

    expect(batchDuration).toBeLessThan(individualDuration * 0.6);
  });

  it('validates lazy loading impact', async () => {
    const agent = new OpportunityAgent({} as any);

    const eagerLoadDuration = await measureDuration(agent, {
      action: 'load_data',
      strategy: 'eager',
    });

    const lazyLoadDuration = await measureDuration(agent, {
      action: 'load_data',
      strategy: 'lazy',
    });

    expect(lazyLoadDuration).toBeLessThan(eagerLoadDuration * 0.7);
  });

  it('validates compression effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const uncompressedResult = await agent.invoke({
      action: 'transfer_data',
      compress: false,
      size: 10 * 1024 * 1024,
    });

    const compressedResult = await agent.invoke({
      action: 'transfer_data',
      compress: true,
      size: 10 * 1024 * 1024,
    });

    expect(compressedResult.transfer_time).toBeLessThan(uncompressedResult.transfer_time * 0.5);
  });

  it('validates index usage optimization', async () => {
    const agent = new OpportunityAgent({} as any);

    const noIndexDuration = await measureDuration(agent, {
      action: 'query',
      use_index: false,
    });

    const withIndexDuration = await measureDuration(agent, {
      action: 'query',
      use_index: true,
    });

    expect(withIndexDuration).toBeLessThan(noIndexDuration * 0.3);
  });
});

describe('StressTesting - Memory Optimization', () => {
  it('validates memory pooling effectiveness', async () => {
    const agent = new OpportunityAgent({} as any);

    const withoutPooling = await measureMemoryUsage(agent, {
      use_memory_pool: false,
      iterations: 100,
    });

    const withPooling = await measureMemoryUsage(agent, {
      use_memory_pool: true,
      iterations: 100,
    });

    expect(withPooling).toBeLessThan(withoutPooling * 0.7);
  });

  it('validates object reuse strategy', async () => {
    const agent = new OpportunityAgent({} as any);

    const noReuse = await measureMemoryUsage(agent, {
      reuse_objects: false,
      iterations: 100,
    });

    const withReuse = await measureMemoryUsage(agent, {
      reuse_objects: true,
      iterations: 100,
    });

    expect(withReuse).toBeLessThan(noReuse * 0.6);
  });

  it('validates streaming processing efficiency', async () => {
    const agent = new OpportunityAgent({} as any);

    const bufferAll = await measureMemoryUsage(agent, {
      action: 'process_large_dataset',
      strategy: 'buffer',
    });

    const streaming = await measureMemoryUsage(agent, {
      action: 'process_large_dataset',
      strategy: 'stream',
    });

    expect(streaming).toBeLessThan(bufferAll * 0.4);
  });
});

// Helper functions
async function measureThroughput(agent: any, nodes: number, requests: number): Promise<number> {
  const startTime = performance.now();

  await Promise.allSettled(
    Array.from({ length: requests }, (_, i) =>
      agent.invoke({
        customer_context: `Throughput test ${i}`,
        nodes,
      })
    )
  );

  const duration = performance.now() - startTime;
  return (requests / duration) * 1000;
}

async function measureDuration(agent: any, config: any): Promise<number> {
  const startTime = performance.now();
  await agent.invoke(config);
  return performance.now() - startTime;
}

async function measureMemoryUsage(agent: any, config: any): Promise<number> {
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  await agent.invoke(config);
  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
  return finalMemory - initialMemory;
}
