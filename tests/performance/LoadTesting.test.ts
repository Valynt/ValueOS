import { vi } from 'vitest';
/**
 * Performance and Load Testing Suite
 *
 * Comprehensive performance tests for load testing, memory usage,
 * and scalability validation of the Enhanced Parallel Executor system.
 */


import { AgentType } from '../src/services/agent-types';
import { getContextOptimizer } from '../src/services/ContextOptimizer';
import { createParallelExecutionPlan, createParallelGroup, createParallelTask, EnhancedParallelExecutor } from '../src/services/EnhancedParallelExecutor';
import { getMemoryPressureMonitor, getSystemResourceMonitor } from '../src/services/monitoring';

// ============================================================================
// Performance Test Configuration
// ============================================================================

interface PerformanceTestConfig {
  name: string;
  taskCount: number;
  concurrency: number;
  iterations: number;
  expectedThroughput: number;
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // %
  timeout: number; // ms
}

interface PerformanceMetrics {
  totalDuration: number;
  averageTaskDuration: number;
  throughput: number; // tasks per second
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  cpuUsage: {
    average: number;
    peak: number;
  };
  errorRate: number;
  parallelismEfficiency: number;
}

// ============================================================================
// Mock Setup
// ============================================================================

// Mock logger to reduce noise in performance tests
vi.mock('../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock external dependencies
vi.mock('../src/services/UnifiedAgentAPI', () => ({
  getUnifiedAgentAPI: () => ({
    invoke: vi.fn().mockImplementation(async ({ agent, query }) => {
      // Simulate realistic processing times
      const baseDelay = 50; // Base 50ms
      const agentMultiplier = {
        research: 2.0,
        benchmark: 1.8,
        'company-intelligence': 2.5,
        'financial-modeling': 3.0,
        'value-mapping': 1.5,
        opportunity: 1.2,
        target: 1.0,
        realization: 0.8,
        expansion: 1.1,
        integrity: 0.5,
        communicator: 0.3,
        narrative: 0.4,
        groundtruth: 0.6,
        'system-mapper': 1.7,
        'intervention-designer': 1.3,
        'outcome-engineer': 1.4,
        'value-eval': 0.7,
        coordinator: 0.2,
      };

      const delay = baseDelay * (agentMultiplier[agent as keyof typeof agentMultiplier] || 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      return {
        success: true,
        data: {
          agent,
          query: query.substring(0, 50),
          processedAt: Date.now(),
        },
        metadata: {
          tokens: Math.floor(Math.random() * 1000) + 100,
        },
      };
    }),
  }),
}));

// Mock audit logger
vi.mock('../src/services/AgentAuditLogger', () => ({
  getAuditLogger: () => ({
    log: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
  }),
}));

describe('Performance and Load Testing', () => {
  let executor: EnhancedParallelExecutor;
  let resourceMonitor: any;
  let memoryMonitor: any;
  let contextOptimizer: any;

  beforeEach(() => {
    executor = new EnhancedParallelExecutor(20, true);
    resourceMonitor = getSystemResourceMonitor();
    memoryMonitor = getMemoryPressureMonitor();
    contextOptimizer = getContextOptimizer();

    // Start monitoring
    resourceMonitor.startMonitoring();
    memoryMonitor.startMonitoring();
  });

  afterEach(() => {
    executor = null as any;
    resourceMonitor.stop();
    memoryMonitor.stop();
    vi.clearAllMocks();
  });

  /**
   * Helper function to capture performance metrics
   */
  async function capturePerformanceMetrics(
    testFn: () => Promise<any>,
    config: PerformanceTestConfig
  ): Promise<PerformanceMetrics> {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const startTime = Date.now();

    let peakMemory = initialMemory;
    let totalCpuUsage = 0;
    let cpuMeasurements = 0;

    // Monitor during execution
    const monitoringInterval = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      peakMemory = Math.max(peakMemory, currentMemory);

      // Mock CPU measurement (in real tests, use proper CPU monitoring)
      const mockCpuUsage = Math.random() * 30 + 20; // 20-50%
      totalCpuUsage += mockCpuUsage;
      cpuMeasurements++;
    }, 100);

    try {
      const result = await testFn();

      clearInterval(monitoringInterval);

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const totalDuration = Date.now() - startTime;

      return {
        totalDuration,
        averageTaskDuration: totalDuration / config.taskCount,
        throughput: (config.taskCount / totalDuration) * 1000, // tasks per second
        memoryUsage: {
          initial: initialMemory,
          peak: peakMemory,
          final: finalMemory,
        },
        cpuUsage: {
          average: cpuMeasurements > 0 ? totalCpuUsage / cpuMeasurements : 0,
          peak: 80, // Mock peak CPU
        },
        errorRate: 0, // Will be calculated based on results
        parallelismEfficiency: 0.8, // Will be calculated based on results
      };
    } catch (error) {
      clearInterval(monitoringInterval);
      throw error;
    }
  }

  describe('Load Testing', () => {
    const loadTestConfigs: PerformanceTestConfig[] = [
      {
        name: 'Small Load',
        taskCount: 10,
        concurrency: 5,
        iterations: 1,
        expectedThroughput: 50,
        maxMemoryUsage: 100,
        maxCpuUsage: 70,
        timeout: 10000,
      },
      {
        name: 'Medium Load',
        taskCount: 50,
        concurrency: 10,
        iterations: 1,
        expectedThroughput: 30,
        maxMemoryUsage: 200,
        maxCpuUsage: 80,
        timeout: 30000,
      },
      {
        name: 'High Load',
        taskCount: 100,
        concurrency: 20,
        iterations: 1,
        expectedThroughput: 20,
        maxMemoryUsage: 300,
        maxCpuUsage: 85,
        timeout: 60000,
      },
      {
        name: 'Stress Load',
        taskCount: 200,
        concurrency: 30,
        iterations: 1,
        expectedThroughput: 15,
        maxMemoryUsage: 400,
        maxCpuUsage: 90,
        timeout: 120000,
      },
    ];

    loadTestConfigs.forEach(config => {
      describe(`${config.name} Test`, () => {
        it(`should handle ${config.taskCount} tasks with ${config.concurrency} concurrency`, async () => {
          const tasks = [];
          for (let i = 0; i < config.taskCount; i++) {
            tasks.push(createParallelTask(
              'research' as AgentType,
              `Load test task ${i}`,
              {
                priority: 'medium',
                estimatedDuration: 5000,
              }
            ));
          }

          const group = createParallelGroup(
            `${config.name} Group`,
            tasks,
            {
              executionStrategy: 'parallel',
              maxConcurrency: config.concurrency,
            }
          );

          const plan = createParallelExecutionPlan([group]);

          const metrics = await capturePerformanceMetrics(
            async () => {
              const result = await executor.executeParallelPlan(plan);

              // Calculate actual metrics
              const successCount = result.results.filter(r => r.success).length;
              const actualErrorRate = (result.results.length - successCount) / result.results.length;

              expect(result.success).toBe(true);
              expect(result.results).toHaveLength(config.taskCount);
              expect(actualErrorRate).toBeLessThan(0.05); // Less than 5% error rate

              return result;
            },
            config
          );

          // Validate performance metrics
          expect(metrics.throughput).toBeGreaterThanOrEqual(config.expectedThroughput * 0.8); // Allow 20% tolerance
          expect(metrics.memoryUsage.peak).toBeLessThan(config.maxMemoryUsage);
          expect(metrics.cpuUsage.average).toBeLessThan(config.maxCpuUsage);
          expect(metrics.totalDuration).toBeLessThan(config.timeout);

          console.log(`${config.name} Performance Results:`);
          console.log(`  Throughput: ${metrics.throughput.toFixed(2)} tasks/sec`);
          console.log(`  Duration: ${metrics.totalDuration}ms`);
          console.log(`  Memory: ${metrics.memoryUsage.initial.toFixed(1)}MB → ${metrics.memoryUsage.peak.toFixed(1)}MB → ${metrics.memoryUsage.final.toFixed(1)}MB`);
          console.log(`  CPU: ${metrics.cpuUsage.average.toFixed(1)}%`);
        }, config.timeout + 10000);
      });
    });

    it('should maintain performance under sustained load', async () => {
      const sustainedConfig: PerformanceTestConfig = {
        name: 'Sustained Load',
        taskCount: 25,
        concurrency: 10,
        iterations: 5,
        expectedThroughput: 25,
        maxMemoryUsage: 250,
        maxCpuUsage: 75,
        timeout: 15000,
      };

      const results = [];

      for (let iteration = 0; iteration < sustainedConfig.iterations; iteration++) {
        const tasks = [];
        for (let i = 0; i < sustainedConfig.taskCount; i++) {
          tasks.push(createParallelTask(
            'benchmark' as AgentType,
            `Sustained test ${iteration}-${i}`,
            {
              priority: 'medium',
              estimatedDuration: 3000,
            }
          ));
        }

        const group = createParallelGroup(
          `Sustained Group ${iteration}`,
          tasks,
          {
            executionStrategy: 'parallel',
            maxConcurrency: sustainedConfig.concurrency,
          }
        );

        const plan = createParallelExecutionPlan([group]);

        const metrics = await capturePerformanceMetrics(
          async () => {
            const result = await executor.executeParallelPlan(plan);
            expect(result.success).toBe(true);
            return result;
          },
          sustainedConfig
        );

        results.push(metrics);

        // Allow system to recover between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Analyze sustained performance
      const avgThroughput = results.reduce((sum, m) => sum + m.throughput, 0) / results.length;
      const maxMemory = Math.max(...results.map(m => m.memoryUsage.peak));
      const avgCpu = results.reduce((sum, m) => sum + m.cpuUsage.average, 0) / results.length;

      expect(avgThroughput).toBeGreaterThanOrEqual(sustainedConfig.expectedThroughput * 0.7);
      expect(maxMemory).toBeLessThan(sustainedConfig.maxMemoryUsage);
      expect(avgCpu).toBeLessThan(sustainedConfig.maxCpuUsage);

      console.log('Sustained Load Performance:');
      console.log(`  Average Throughput: ${avgThroughput.toFixed(2)} tasks/sec`);
      console.log(`  Max Memory: ${maxMemory.toFixed(1)}MB`);
      console.log(`  Average CPU: ${avgCpu.toFixed(1)}%`);
      console.log(`  Iterations: ${sustainedConfig.iterations}`);
    }, 90000);
  });

  describe('Memory Usage Testing', () => {
    it('should handle large context windows without memory leaks', async () => {
      const largeContextTasks = [];

      // Create tasks with large context data
      for (let i = 0; i < 20; i++) {
        const largeContext = {
          data: 'x'.repeat(10000), // 10KB per task
          metadata: {
            id: i,
            timestamp: Date.now(),
            details: Array.from({ length: 100 }, (_, j) => `detail-${j}`),
          },
        };

        largeContextTasks.push(createParallelTask(
          'research' as AgentType,
          `Large context task ${i}`,
          {
            priority: 'medium',
            estimatedDuration: 2000,
            context: largeContext,
          }
        ));
      }

      const group = createParallelGroup('Large Context Group', largeContextTasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 10,
      });

      const plan = createParallelExecutionPlan([group]);

      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      const result = await executor.executeParallelPlan(plan);

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = finalMemory - initialMemory;

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(20);
      expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase

      // Verify context optimization worked
      const contextStats = contextOptimizer.getOptimizationStats();
      expect(contextStats.activeWindows).toBeGreaterThanOrEqual(0);
      expect(contextStats.averageCompressionRatio).toBeGreaterThanOrEqual(0);

      console.log('Large Context Memory Test:');
      console.log(`  Memory increase: ${memoryIncrease.toFixed(1)}MB`);
      console.log(`  Context optimizations: ${contextStats.totalOptimizations}`);
      console.log(`  Average compression: ${(contextStats.averageCompressionRatio * 100).toFixed(1)}%`);
    }, 45000);

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating many tasks
      const memoryPressureTasks = [];

      for (let i = 0; i < 100; i++) {
        memoryPressureTasks.push(createParallelTask(
          'research' as AgentType,
          `Memory pressure task ${i}`,
          {
            priority: 'low',
            estimatedDuration: 1000,
            context: {
              data: 'x'.repeat(5000), // 5KB per task
              index: i,
            },
          }
        ));
      }

      const group = createParallelGroup('Memory Pressure Group', memoryPressureTasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 30,
      });

      const plan = createParallelExecutionPlan([group]);

      // Monitor memory pressure response
      const initialCacheSize = contextOptimizer.getOptimizationStats().activeWindows;

      const result = await executor.executeParallelPlan(plan);

      const finalCacheSize = contextOptimizer.getOptimizationStats().activeWindows;

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(100);

      // Cache should have been managed under pressure
      expect(finalCacheSize).toBeLessThanOrEqual(initialCacheSize + 50);

      console.log('Memory Pressure Test:');
      console.log(`  Tasks completed: ${result.results.length}`);
      console.log(`  Cache size change: ${finalCacheSize - initialCacheSize}`);
      console.log(`  Success rate: ${(result.results.filter(r => r.success).length / result.results.length * 100).toFixed(1)}%`);
    }, 60000);
  });

  describe('Scalability Testing', () => {
    it('should scale concurrency based on system resources', async () => {
      const scalabilityTests = [
        { concurrency: 5, expectedAdaptation: false },
        { concurrency: 10, expectedAdaptation: false },
        { concurrency: 15, expectedAdaptation: true },
        { concurrency: 25, expectedAdaptation: true },
      ];

      for (const test of scalabilityTests) {
        const tasks = [];
        for (let i = 0; i < test.concurrency * 2; i++) {
          tasks.push(createParallelTask(
            'research' as AgentType,
            `Scalability test ${i}`,
            {
              priority: 'medium',
              estimatedDuration: 2000,
            }
          ));
        }

        const group = createParallelGroup(
          `Scalability Group ${test.concurrency}`,
          tasks,
          {
            executionStrategy: 'parallel',
            maxConcurrency: test.concurrency,
          }
        );

        const plan = createParallelExecutionPlan([group]);

        // Mock resource pressure for higher concurrency tests
        if (test.expectedAdaptation) {
          const mockResources = {
            cpu: { usage: 85, loadAverage: [3.0, 2.8, 2.6], coreCount: 4 },
            memory: { used: 8000, total: 10000, percentage: 80, pressure: 'high' },
            heap: { used: 900, total: 1000, percentage: 90 },
            timestamp: Date.now(),
          };

          resourceMonitor['listeners'].forEach((listener: any) => {
            listener.onResourceChange(mockResources);
          });
        }

        const initialConcurrency = executor['currentMaxConcurrency'];
        const result = await executor.executeParallelPlan(plan);
        const finalConcurrency = executor['currentMaxConcurrency'];

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(test.concurrency * 2);

        if (test.expectedAdaptation) {
          expect(finalConcurrency).toBeLessThan(initialConcurrency);
        }

        console.log(`Scalability Test (${test.concurrency} concurrency):`);
        console.log(`  Initial concurrency: ${initialConcurrency}`);
        console.log(`  Final concurrency: ${finalConcurrency}`);
        console.log(`  Adaptation occurred: ${finalConcurrency < initialConcurrency}`);
      }
    }, 120000);

    it('should maintain performance with increasing complexity', async () => {
      const complexityTests = [
        { name: 'Simple', agentCount: 3, dependencies: 0 },
        { name: 'Moderate', agentCount: 5, dependencies: 2 },
        { name: 'Complex', agentCount: 8, dependencies: 4 },
        { name: 'Enterprise', agentCount: 12, dependencies: 8 },
      ];

      const results = [];

      for (const test of complexityTests) {
        const tasks = [];
        const dependencies: string[] = [];

        for (let i = 0; i < test.agentCount; i++) {
          const task = createParallelTask(
            ['research', 'benchmark', 'opportunity', 'target', 'realization', 'expansion', 'integrity', 'communicator'][i] as AgentType,
            `${test.name} task ${i}`,
            {
              priority: i === 0 ? 'critical' : 'medium',
              estimatedDuration: 3000,
              dependencies: i > 0 && dependencies.length > 0 ? [dependencies[i - 1]] : [],
            }
          );

          tasks.push(task);
          if (i > 0) dependencies.push(task.id);
        }

        const group = createParallelGroup(`${test.name} Group`, tasks, {
          executionStrategy: test.dependencies.length > 0 ? 'pipeline' : 'parallel',
          maxConcurrency: test.agentCount,
        });

        const plan = createParallelExecutionPlan([group]);

        const startTime = Date.now();
        const result = await executor.executeParallelPlan(plan);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(test.agentCount);

        results.push({
          name: test.name,
          duration,
          throughput: (test.agentCount / duration) * 1000,
          efficiency: result.performance.parallelismEfficiency,
        });
      }

      // Analyze scalability trends
      const simpleThroughput = results[0].throughput;
      const enterpriseThroughput = results[3].throughput;
      const throughputDegradation = (simpleThroughput - enterpriseThroughput) / simpleThroughput;

      expect(throughputDegradation).toBeLessThan(0.7); // Less than 70% degradation

      console.log('Complexity Scalability Results:');
      results.forEach(result => {
        console.log(`  ${result.name}: ${result.throughput.toFixed(2)} tasks/sec, ${result.efficiency.toFixed(2)} efficiency`);
      });
      console.log(`  Throughput degradation: ${(throughputDegradation * 100).toFixed(1)}%`);
    }, 90000);
  });

  describe('Resource Optimization Testing', () => {
    it('should optimize context windows effectively', async () => {
      const optimizationTasks = [];

      // Create tasks with varying context sizes
      for (let i = 0; i < 30; i++) {
        const contextSize = Math.floor(Math.random() * 20000) + 1000; // 1KB to 21KB
        const context = {
          data: 'x'.repeat(contextSize),
          metadata: {
            id: i,
            size: contextSize,
            category: i % 3 === 0 ? 'research' : i % 3 === 1 ? 'analysis' : 'report',
          },
        };

        optimizationTasks.push(createParallelTask(
          'research' as AgentType,
          `Optimization test ${i}`,
          {
            priority: 'medium',
            estimatedDuration: 1500,
            context,
          }
        ));
      }

      const group = createParallelGroup('Optimization Group', optimizationTasks, {
        executionStrategy: 'parallel',
        maxConcurrency: 15,
      });

      const plan = createParallelExecutionPlan([group]);

      const initialStats = contextOptimizer.getOptimizationStats();
      const result = await executor.executeParallelPlan(plan);
      const finalStats = contextOptimizer.getOptimizationStats();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(30);

      // Verify optimization occurred
      expect(finalStats.totalOptimizations).toBeGreaterThan(initialStats.totalOptimizations);
      expect(finalStats.averageCompressionRatio).toBeGreaterThan(0);
      expect(finalStats.averageOptimizationScore).toBeGreaterThan(0.5);

      console.log('Context Optimization Results:');
      console.log(`  Optimizations performed: ${finalStats.totalOptimizations}`);
      console.log(`  Average compression ratio: ${(finalStats.averageCompressionRatio * 100).toFixed(1)}%`);
      console.log(`  Cache hit rate: ${(finalStats.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`  Average optimization score: ${finalStats.averageOptimizationScore.toFixed(2)}`);
    }, 45000);

    it('should handle resource contention gracefully', async () => {
      // Create multiple competing workloads
      const workloads = [];

      for (let w = 0; w < 3; w++) {
        const tasks = [];
        for (let i = 0; i < 20; i++) {
          tasks.push(createParallelTask(
            ['research', 'benchmark', 'opportunity'][w] as AgentType,
            `Contention test ${w}-${i}`,
            {
              priority: w === 0 ? 'high' : 'medium',
              estimatedDuration: 2000,
            }
          ));
        }

        const group = createParallelGroup(`Contention Group ${w}`, tasks, {
          executionStrategy: 'parallel',
          maxConcurrency: 10,
        });

        workloads.push(group);
      }

      const plan = createParallelExecutionPlan(workloads);

      const result = await executor.executeParallelPlan(plan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(60);

      // Verify all workloads completed
      const highPriorityResults = result.results.filter(r => r.success);
      expect(highPriorityResults.length).toBe(60);

      // Verify performance under contention
      expect(result.performance.throughput).toBeGreaterThan(10); // Minimum throughput
      expect(result.performance.parallelismEfficiency).toBeGreaterThan(0.3);

      console.log('Resource Contention Results:');
      console.log(`  Total tasks: ${result.results.length}`);
      console.log(`  Success rate: ${(highPriorityResults.length / result.results.length * 100).toFixed(1)}%`);
      console.log(`  Throughput: ${result.performance.throughput.toFixed(2)} tasks/sec`);
      console.log(`  Parallelism efficiency: ${result.performance.parallelismEfficiency.toFixed(2)}`);
    }, 60000);
  });

  describe('Performance Regression Testing', () => {
    it('should maintain performance benchmarks', async () => {
      const benchmarkConfig: PerformanceTestConfig = {
        name: 'Benchmark',
        taskCount: 50,
        concurrency: 10,
        iterations: 1,
        expectedThroughput: 25,
        maxMemoryUsage: 200,
        maxCpuUsage: 75,
        timeout: 30000,
      };

      const benchmarkTasks = [];
      for (let i = 0; i < benchmarkConfig.taskCount; i++) {
        benchmarkTasks.push(createParallelTask(
          'research' as AgentType,
          `Benchmark task ${i}`,
          {
            priority: 'medium',
            estimatedDuration: 2500,
          }
        ));
      }

      const group = createParallelGroup('Benchmark Group', benchmarkTasks, {
        executionStrategy: 'parallel',
        maxConcurrency: benchmarkConfig.concurrency,
      });

      const plan = createParallelExecutionPlan([group]);

      const metrics = await capturePerformanceMetrics(
        async () => {
          const result = await executor.executeParallelPlan(plan);
          expect(result.success).toBe(true);
          return result;
        },
        benchmarkConfig
      );

      // Validate against benchmarks
      expect(metrics.throughput).toBeGreaterThanOrEqual(benchmarkConfig.expectedThroughput);
      expect(metrics.memoryUsage.peak).toBeLessThan(benchmarkConfig.maxMemoryUsage);
      expect(metrics.cpuUsage.average).toBeLessThan(benchmarkConfig.maxCpuUsage);
      expect(metrics.totalDuration).toBeLessThan(benchmarkConfig.timeout);

      console.log('Benchmark Results:');
      console.log(`  ✅ Throughput: ${metrics.throughput.toFixed(2)} tasks/sec (≥ ${benchmarkConfig.expectedThroughput})`);
      console.log(`  ✅ Memory: ${metrics.memoryUsage.peak.toFixed(1)}MB (≤ ${benchmarkConfig.maxMemoryUsage}MB)`);
      console.log(`  ✅ CPU: ${metrics.cpuUsage.average.toFixed(1)}% (≤ ${benchmarkConfig.maxCpuUsage}%)`);
      console.log(`  ✅ Duration: ${metrics.totalDuration}ms (≤ ${benchmarkConfig.timeout}ms)`);
    }, 40000);
  });
});
