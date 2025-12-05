/**
 * Load Testing Tests
 * 
 * Tests system behavior under high-volume load conditions,
 * validates scalability, and identifies performance bottlenecks.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../lib/agent-fabric/agents/ExpansionAgent';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const runPerf = process.env.RUN_PERF_TESTS === 'true';
const describeMaybe = runIntegration && runPerf ? describe : describe.skip;

describeMaybe('LoadTesting - High Volume Requests', () => {
  it('handles 1000 sequential requests', async () => {
    const agent = new OpportunityAgent({} as any);
    const requestCount = 1000;

    const startTime = performance.now();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < requestCount; i++) {
      const result = await agent.invoke({
        customer_context: `Load test ${i}`,
      });

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    const duration = performance.now() - startTime;
    const avgDuration = duration / requestCount;
    const successRate = successCount / requestCount;

    expect(successRate).toBeGreaterThan(0.95);
    expect(avgDuration).toBeLessThan(1000);
    expect(duration).toBeLessThan(300000);
  });

  it('handles 500 concurrent requests', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentCount = 500;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({
          customer_context: `Concurrent load ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / concurrentCount;

    expect(successRate).toBeGreaterThan(0.90);
    expect(duration).toBeLessThan(60000);
  });

  it('maintains performance under sustained load', async () => {
    const agent = new OpportunityAgent({} as any);
    const duration = 30000;
    const requestsPerSecond = 10;
    const interval = 1000 / requestsPerSecond;

    const startTime = Date.now();
    let requestCount = 0;
    let successCount = 0;

    while (Date.now() - startTime < duration) {
      const result = await agent.invoke({
        customer_context: `Sustained load ${requestCount}`,
      });

      if (result.success) {
        successCount++;
      }

      requestCount++;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    const successRate = successCount / requestCount;

    expect(successRate).toBeGreaterThan(0.95);
    expect(requestCount).toBeGreaterThan(250);
  });
});

describeMaybe('LoadTesting - Burst Traffic', () => {
  it('handles sudden traffic spike', async () => {
    const agent = new OpportunityAgent({} as any);

    const warmupCount = 10;
    for (let i = 0; i < warmupCount; i++) {
      await agent.invoke({
        customer_context: `Warmup ${i}`,
      });
    }

    const burstCount = 200;
    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: burstCount }, (_, i) =>
        agent.invoke({
          customer_context: `Burst ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / burstCount;

    expect(successRate).toBeGreaterThan(0.85);
    expect(duration).toBeLessThan(30000);
  });

  it('recovers from traffic spike', async () => {
    const agent = new OpportunityAgent({} as any);

    const burstCount = 100;
    await Promise.allSettled(
      Array.from({ length: burstCount }, (_, i) =>
        agent.invoke({
          customer_context: `Spike ${i}`,
        })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const recoveryCount = 10;
    const startTime = performance.now();

    for (let i = 0; i < recoveryCount; i++) {
      await agent.invoke({
        customer_context: `Recovery ${i}`,
      });
    }

    const duration = performance.now() - startTime;
    const avgDuration = duration / recoveryCount;

    expect(avgDuration).toBeLessThan(1000);
  });

  it('handles multiple consecutive bursts', async () => {
    const agent = new OpportunityAgent({} as any);
    const burstCount = 50;
    const burstIterations = 5;

    let totalSuccess = 0;
    let totalRequests = 0;

    for (let burst = 0; burst < burstIterations; burst++) {
      const results = await Promise.allSettled(
        Array.from({ length: burstCount }, (_, i) =>
          agent.invoke({
            customer_context: `Burst ${burst} Request ${i}`,
          })
        )
      );

      totalSuccess += results.filter((r) => r.status === 'fulfilled').length;
      totalRequests += burstCount;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const successRate = totalSuccess / totalRequests;

    expect(successRate).toBeGreaterThan(0.90);
  });
});

describeMaybe('LoadTesting - Multi-Agent Load', () => {
  it('handles concurrent load across multiple agent types', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);
    const expansionAgent = new ExpansionAgent({} as any);

    const requestsPerAgent = 50;

    const startTime = performance.now();

    const results = await Promise.allSettled([
      ...Array.from({ length: requestsPerAgent }, (_, i) =>
        opportunityAgent.invoke({
          customer_context: `Opp ${i}`,
        })
      ),
      ...Array.from({ length: requestsPerAgent }, (_, i) =>
        targetAgent.invoke({
          opportunity_id: `opp-${i}`,
        })
      ),
      ...Array.from({ length: requestsPerAgent }, (_, i) =>
        expansionAgent.invoke({
          value_tree_id: `tree-${i}`,
        })
      ),
    ]);

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const totalRequests = requestsPerAgent * 3;
    const successRate = successCount / totalRequests;

    expect(successRate).toBeGreaterThan(0.85);
    expect(duration).toBeLessThan(60000);
  });

  it('maintains isolation between agent types under load', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const heavyLoadCount = 100;
    const lightLoadCount = 10;

    const heavyLoadPromise = Promise.allSettled(
      Array.from({ length: heavyLoadCount }, (_, i) =>
        opportunityAgent.invoke({
          customer_context: `Heavy ${i}`,
        })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const startTime = performance.now();

    const lightLoadResults = await Promise.all(
      Array.from({ length: lightLoadCount }, (_, i) =>
        targetAgent.invoke({
          opportunity_id: `opp-${i}`,
        })
      )
    );

    const lightLoadDuration = performance.now() - startTime;
    const avgLightLoadDuration = lightLoadDuration / lightLoadCount;

    await heavyLoadPromise;

    expect(avgLightLoadDuration).toBeLessThan(2000);
  });
});

describeMaybe('LoadTesting - Database Load', () => {
  it('handles high-volume database writes', async () => {
    const agent = new OpportunityAgent({} as any);
    const writeCount = 500;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: writeCount }, (_, i) =>
        agent.invoke({
          action: 'create',
          customer_context: `Write ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / writeCount;

    expect(successRate).toBeGreaterThan(0.90);
    expect(duration).toBeLessThan(60000);
  });

  it('handles high-volume database reads', async () => {
    const agent = new OpportunityAgent({} as any);
    const readCount = 1000;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: readCount }, (_, i) =>
        agent.invoke({
          action: 'get',
          opportunity_id: `opp-${i % 100}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / readCount;

    expect(successRate).toBeGreaterThan(0.95);
    expect(duration).toBeLessThan(30000);
  });

  it('handles mixed read/write load', async () => {
    const agent = new OpportunityAgent({} as any);
    const operationCount = 500;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: operationCount }, (_, i) =>
        agent.invoke({
          action: i % 3 === 0 ? 'create' : 'get',
          customer_context: i % 3 === 0 ? `Create ${i}` : undefined,
          opportunity_id: i % 3 !== 0 ? `opp-${i % 100}` : undefined,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / operationCount;

    expect(successRate).toBeGreaterThan(0.90);
    expect(duration).toBeLessThan(60000);
  });

  it('connection pool handles high concurrency', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentQueries = 100;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: concurrentQueries }, (_, i) =>
        agent.invoke({
          action: 'complex_query',
          filters: { id: `opp-${i}` },
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / concurrentQueries;

    expect(successRate).toBeGreaterThan(0.90);
    expect(duration).toBeLessThan(15000);
  });
});

describeMaybe('LoadTesting - Memory Under Load', () => {
  it('memory usage remains stable under sustained load', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 200;
    const measurements: number[] = [];

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        customer_context: `Memory load ${i}`,
      });

      if (i % 20 === 0) {
        const memory = (performance as any).memory?.usedJSHeapSize || 0;
        measurements.push(memory);
      }
    }

    const firstQuarter = measurements.slice(0, Math.floor(measurements.length / 4));
    const lastQuarter = measurements.slice(-Math.floor(measurements.length / 4));

    const avgFirst = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
    const avgLast = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

    const memoryGrowth = (avgLast - avgFirst) / avgFirst;

    expect(memoryGrowth).toBeLessThan(0.5);
  });

  it('garbage collection keeps memory in check', async () => {
    const agent = new OpportunityAgent({} as any);
    const iterations = 100;

    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < iterations; i++) {
      await agent.invoke({
        customer_context: `GC test ${i}`,
      });

      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});

describeMaybe('LoadTesting - Error Handling Under Load', () => {
  it('maintains error rate below threshold under load', async () => {
    const agent = new OpportunityAgent({} as any);
    const requestCount = 500;

    const results = await Promise.allSettled(
      Array.from({ length: requestCount }, (_, i) =>
        agent.invoke({
          customer_context: `Error test ${i}`,
          force_random_errors: true,
          error_rate: 0.05,
        })
      )
    );

    const errorCount = results.filter((r) => r.status === 'rejected').length;
    const errorRate = errorCount / requestCount;

    expect(errorRate).toBeLessThan(0.10);
  });

  it('circuit breaker activates under high error rate', async () => {
    const agent = new OpportunityAgent({} as any);
    const requestCount = 100;

    const results = await Promise.allSettled(
      Array.from({ length: requestCount }, (_, i) =>
        agent.invoke({
          customer_context: `Circuit breaker ${i}`,
          force_errors: true,
        })
      )
    );

    const circuitBreakerActivated = results.some(
      (r) => r.status === 'rejected' && r.reason?.includes('circuit breaker')
    );

    expect(circuitBreakerActivated).toBe(true);
  });

  it('system recovers after error spike', async () => {
    const agent = new OpportunityAgent({} as any);

    await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        agent.invoke({
          customer_context: `Error spike ${i}`,
          force_errors: true,
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

    expect(successRate).toBeGreaterThan(0.90);
  });
});

describeMaybe('LoadTesting - Scalability', () => {
  it('throughput scales with increased resources', async () => {
    const agent = new OpportunityAgent({} as any);

    const scenarios = [
      { workers: 1, requests: 50 },
      { workers: 2, requests: 100 },
      { workers: 4, requests: 200 },
    ];

    const throughputs: number[] = [];

    for (const scenario of scenarios) {
      const startTime = performance.now();

      await Promise.all(
        Array.from({ length: scenario.requests }, (_, i) =>
          agent.invoke({
            customer_context: `Scale test ${i}`,
            workers: scenario.workers,
          })
        )
      );

      const duration = performance.now() - startTime;
      const throughput = (scenario.requests / duration) * 1000;
      throughputs.push(throughput);
    }

    expect(throughputs[1]).toBeGreaterThan(throughputs[0] * 1.5);
    expect(throughputs[2]).toBeGreaterThan(throughputs[1] * 1.5);
  });

  it('horizontal scaling improves capacity', async () => {
    const agent = new OpportunityAgent({} as any);

    const singleInstanceCount = 100;
    const startTimeSingle = performance.now();

    await Promise.allSettled(
      Array.from({ length: singleInstanceCount }, (_, i) =>
        agent.invoke({
          customer_context: `Single ${i}`,
          instances: 1,
        })
      )
    );

    const durationSingle = performance.now() - startTimeSingle;

    const multiInstanceCount = 200;
    const startTimeMulti = performance.now();

    await Promise.allSettled(
      Array.from({ length: multiInstanceCount }, (_, i) =>
        agent.invoke({
          customer_context: `Multi ${i}`,
          instances: 2,
        })
      )
    );

    const durationMulti = performance.now() - startTimeMulti;

    const scalingFactor = (multiInstanceCount / durationMulti) / (singleInstanceCount / durationSingle);

    expect(scalingFactor).toBeGreaterThan(1.5);
  });
});

describeMaybe('LoadTesting - Resource Contention', () => {
  it('handles resource contention gracefully', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentCount = 100;

    const startTime = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({
          action: 'resource_intensive',
          resource_id: `resource-${i % 10}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const successRate = successCount / concurrentCount;

    expect(successRate).toBeGreaterThan(0.85);
    expect(duration).toBeLessThan(30000);
  });

  it('lock contention does not cause deadlocks', async () => {
    const agent = new OpportunityAgent({} as any);
    const concurrentCount = 50;

    const results = await Promise.allSettled(
      Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({
          action: 'acquire_lock',
          lock_id: `lock-${i % 5}`,
          timeout: 5000,
        })
      )
    );

    const deadlocks = results.filter(
      (r) => r.status === 'rejected' && r.reason?.includes('deadlock')
    );

    expect(deadlocks.length).toBe(0);
  });
});
