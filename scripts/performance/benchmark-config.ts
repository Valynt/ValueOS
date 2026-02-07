/**
 * VOS-QA-003: Performance Benchmark Configuration
 * Centralized configuration for all performance benchmarks
 */

export interface BenchmarkConfig {
  name: string;
  thresholds: {
    p50: number;    // 50th percentile
    p95: number;    // 95th percentile
    p99: number;    // 99th percentile
    max: number;    // Maximum allowed
  };
  iterations: number;
  warmup: number;
  timeout: number;
}

export interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: BenchmarkConfig[];
}

export const benchmarkSuites: Record<string, BenchmarkSuite> = {
  agent: {
    name: 'Agent Performance',
    description: 'Core agent system performance metrics',
    benchmarks: [
      {
        name: 'agent_creation',
        thresholds: { p50: 50, p95: 100, p99: 200, max: 500 },
        iterations: 1000,
        warmup: 100,
        timeout: 5000,
      },
      {
        name: 'message_processing',
        thresholds: { p50: 10, p95: 50, p99: 100, max: 200 },
        iterations: 5000,
        warmup: 500,
        timeout: 10000,
      },
      {
        name: 'workflow_execution',
        thresholds: { p50: 100, p95: 300, p99: 500, max: 1000 },
        iterations: 100,
        warmup: 10,
        timeout: 5000,
      },
      {
        name: 'memory_usage_100_agents',
        thresholds: { p50: 200, p95: 300, p99: 400, max: 500 },
        iterations: 10,
        warmup: 1,
        timeout: 10000,
      },
    ],
  },

  ui: {
    name: 'UI Component Performance',
    description: 'React component rendering and interaction',
    benchmarks: [
      {
        name: 'trinity_dashboard_render',
        thresholds: { p50: 50, p95: 100, p99: 150, max: 200 },
        iterations: 100,
        warmup: 10,
        timeout: 2000,
      },
      {
        name: 'sankey_diagram_render',
        thresholds: { p50: 100, p95: 200, p99: 300, max: 500 },
        iterations: 50,
        warmup: 5,
        timeout: 3000,
      },
      {
        name: 'scenario_matrix_render',
        thresholds: { p50: 75, p95: 150, p99: 250, max: 400 },
        iterations: 75,
        warmup: 8,
        timeout: 2500,
      },
      {
        name: 'audit_trail_table_render',
        thresholds: { p50: 60, p95: 120, p99: 200, max: 300 },
        iterations: 200,
        warmup: 20,
        timeout: 3000,
      },
    ],
  },

  security: {
    name: 'Security Performance',
    description: 'Security operations and validation',
    benchmarks: [
      {
        name: 'xss_sanitization',
        thresholds: { p50: 5, p95: 10, p99: 20, max: 50 },
        iterations: 1000,
        warmup: 100,
        timeout: 2000,
      },
      {
        name: 'session_validation',
        thresholds: { p50: 1, p95: 2, p99: 5, max: 10 },
        iterations: 10000,
        warmup: 1000,
        timeout: 5000,
      },
      {
        name: 'permission_check',
        thresholds: { p50: 2, p95: 5, p99: 10, max: 20 },
        iterations: 5000,
        warmup: 500,
        timeout: 3000,
      },
      {
        name: 'audit_log_write',
        thresholds: { p50: 3, p95: 8, p99: 15, max: 30 },
        iterations: 2000,
        warmup: 200,
        timeout: 4000,
      },
    ],
  },

  integration: {
    name: 'Integration Performance',
    description: 'End-to-end workflow performance',
    benchmarks: [
      {
        name: 'opportunity_to_target_flow',
        thresholds: { p50: 500, p95: 1000, p99: 2000, max: 5000 },
        iterations: 20,
        warmup: 2,
        timeout: 10000,
      },
      {
        name: 'multi_agent_orchestration',
        thresholds: { p50: 300, p95: 600, p99: 1000, max: 2000 },
        iterations: 30,
        warmup: 3,
        timeout: 8000,
      },
      {
        name: 'concurrent_user_load',
        thresholds: { p50: 100, p95: 200, p99: 400, max: 800 },
        iterations: 100,
        warmup: 10,
        timeout: 15000,
      },
    ],
  },

  chaos: {
    name: 'Chaos Engineering Resilience',
    description: 'System resilience under chaos',
    benchmarks: [
      {
        name: 'network_latency_recovery',
        thresholds: { p50: 100, p95: 200, p99: 300, max: 500 },
        iterations: 10,
        warmup: 1,
        timeout: 5000,
      },
      {
        name: 'pod_failure_recovery',
        thresholds: { p50: 500, p95: 1000, p99: 2000, max: 5000 },
        iterations: 5,
        warmup: 0,
        timeout: 10000,
      },
      {
        name: 'database_connection_drop',
        thresholds: { p50: 200, p95: 400, p99: 600, max: 1000 },
        iterations: 8,
        warmup: 1,
        timeout: 8000,
      },
    ],
  },
};

export const globalConfig = {
  // Overall benchmark settings
  timeout: 30000,           // Global timeout per benchmark suite
  maxRetries: 3,            // Retry failed benchmarks
  failFast: false,          // Continue on failure
  verbose: true,            // Detailed output
  
  // Reporting
  reportFormat: ['json', 'html', 'console'] as const,
  reportDirectory: './reports/performance',
  
  // Performance monitoring
  monitorMemory: true,
  monitorCPU: true,
  monitorEventLoop: true,
  
  // Alerting
  alerts: {
    enabled: true,
    threshold: 0.8,         // Alert if 80% of threshold exceeded
    channels: ['console', 'email'],
  },
  
  // Regression detection
  regression: {
    enabled: true,
    baselineFile: './reports/performance/baseline.json',
    tolerance: 0.1,         // 10% tolerance
    failOnRegression: false, // Don't fail CI, just warn
  },
};

export const performanceTargets = {
  // Overall system targets
  system: {
    availability: 99.9,     // Percentage
    responseTime: 500,      // ms
    throughput: 1000,       // requests/second
    errorRate: 0.1,         // Percentage
  },
  
  // Component-specific targets
  components: {
    agent: {
      creation: 100,        // ms
      messageProcessing: 50, // ms
      workflow: 300,        // ms
    },
    ui: {
      render: 100,          // ms
      interaction: 50,      // ms
      dataLoad: 200,        // ms
    },
    security: {
      validation: 5,        // ms
      encryption: 10,       // ms
      audit: 5,             // ms
    },
  },
};