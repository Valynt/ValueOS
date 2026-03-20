import { SupabaseClient } from '@supabase/supabase-js';
import { AlertingService, AlertRule } from '../AlertingService.js';
import { getMetricsCollector } from '../MetricsCollector.js';
import { performance } from 'perf_hooks';

// Setup to simulate network/database latency
const latencyMs = 5;

// Mock getMetricsCollector
const mockGetMetricsCollector = {
  getAgentMetrics: async () => {
    // Simulate DB query delay
    await new Promise(resolve => setTimeout(resolve, latencyMs));
    return [{
      totalInvocations: 1000,
      successfulInvocations: 950,
      hallucinationRate: 0.02,
      avgConfidenceScore: 0.9,
      p95ResponseTime: 200,
      p99ResponseTime: 500
    }];
  },
  getSystemMetrics: async () => {
    // Simulate DB query delay
    await new Promise(resolve => setTimeout(resolve, latencyMs));
    return {
      totalCost: 150.5,
      cacheHitRate: 0.85
    };
  }
};

async function runBenchmark() {
  const mockSupabase = {} as unknown as SupabaseClient;

  // Create an alerting service instance with mock
  const alertingService = new AlertingService(mockSupabase);
  (alertingService as any).metricsCollector = mockGetMetricsCollector;
  (alertingService as any).triggerAlert = async () => {};

  // Create a large rule to test N+1 query issue
  const largeRule: AlertRule = {
    id: 'large-rule',
    name: 'Large Benchmark Rule',
    enabled: true,
    checkIntervalMinutes: 5,
    notificationChannels: [],
    thresholds: Array(100).fill(null).map((_, i) => ({
      metricName: i % 2 === 0 ? `agent.p95_response_time` : 'llm.hourly_cost',
      operator: 'gt',
      threshold: 1000 + i,
      severity: 'info',
      description: 'Test threshold'
    }))
  };

  const iterations = 5;

  console.log(`Running baseline with ${iterations} iterations and ${largeRule.thresholds.length} thresholds (simulated latency ${latencyMs}ms)...`);

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await (alertingService as any).checkRule(largeRule);
  }

  const end = performance.now();
  const time = end - start;

  console.log(`Total time: ${time.toFixed(2)}ms`);
  console.log(`Average time per checkRule: ${(time / iterations).toFixed(2)}ms`);
}

runBenchmark().catch(console.error);
