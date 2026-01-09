/**
 * VOS-QA-003: Agent Performance Benchmarks
 * Comprehensive performance testing for agent systems
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AgentFabric } from '../../src/lib/agent-fabric/AgentFabric';
import { BaseAgent } from '../../src/lib/agent-fabric/agents/BaseAgent';
import { SecureMessageBus } from '../../src/lib/agent-fabric/SecureMessageBus';
import { auditLogService } from '../../src/services/AuditLogService';

interface BenchmarkResult {
  name: string;
  duration: number;
  memory: number;
  throughput: number;
  status: 'pass' | 'fail';
}

describe('Agent Performance Benchmarks', () => {
  let agentFabric: AgentFabric;
  let messageBus: SecureMessageBus;
  const benchmarkResults: BenchmarkResult[] = [];

  beforeAll(async () => {
    // Initialize test environment
    agentFabric = new AgentFabric();
    messageBus = new SecureMessageBus();
    
    // Warm up JIT
    await agentFabric.createAgent('test-warmup', 'CoordinatorAgent');
  });

  beforeEach(() => {
    // Clear any existing state
    benchmarkResults.length = 0;
  });

  afterEach(() => {
    // Log benchmark results
    if (benchmarkResults.length > 0) {
      const avgDuration = benchmarkResults.reduce((sum, r) => sum + r.duration, 0) / benchmarkResults.length;
      console.log(`\n📊 Benchmark: ${benchmarkResults[0].name}`);
      console.log(`   Average: ${avgDuration.toFixed(2)}ms`);
      console.log(`   Memory: ${benchmarkResults[0].memory}MB`);
    }
  });

  describe('Agent Creation Performance', () => {
    it('should create single agent in <100ms', async () => {
      const start = performance.now();
      const agent = await agentFabric.createAgent('test-1', 'CoordinatorAgent');
      const duration = performance.now() - start;

      expect(agent).toBeDefined();
      expect(duration).toBeLessThan(100);

      benchmarkResults.push({
        name: 'agent_creation_single',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1 / (duration / 1000),
        status: duration < 100 ? 'pass' : 'fail',
      });
    });

    it('should create 100 agents in <5 seconds', async () => {
      const start = performance.now();
      const agents = await Promise.all(
        Array.from({ length: 100 }, (_, i) => 
          agentFabric.createAgent(`test-${i}`, 'CoordinatorAgent')
        )
      );
      const duration = performance.now() - start;

      expect(agents).toHaveLength(100);
      expect(duration).toBeLessThan(5000);

      benchmarkResults.push({
        name: 'agent_creation_bulk',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 100 / (duration / 1000),
        status: duration < 5000 ? 'pass' : 'fail',
      });
    });

    it('should handle concurrent agent creation', async () => {
      const concurrency = 50;
      const batches = 5;
      const totalStart = performance.now();

      for (let batch = 0; batch < batches; batch++) {
        const batchStart = batch * concurrency;
        await Promise.all(
          Array.from({ length: concurrency }, (_, i) =>
            agentFabric.createAgent(`concurrent-${batchStart + i}`, 'TargetAgent')
          )
        );
      }

      const duration = performance.now() - totalStart;
      const totalAgents = concurrency * batches;

      expect(duration).toBeLessThan(10000);

      benchmarkResults.push({
        name: 'agent_creation_concurrent',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: totalAgents / (duration / 1000),
        status: duration < 10000 ? 'pass' : 'fail',
      });
    });
  });

  describe('Message Bus Performance', () => {
    it('should publish/subscribe in <10ms', async () => {
      const testMessage = { type: 'test', data: 'performance-test' };
      let received = false;

      const unsubscribe = messageBus.subscribe('test-channel', (msg) => {
        received = true;
        expect(msg).toEqual(testMessage);
      });

      const start = performance.now();
      await messageBus.publish('test-channel', testMessage);
      
      // Wait for message with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!received) reject(new Error('Message not received'));
        }, 50);
        const check = setInterval(() => {
          if (received) {
            clearInterval(check);
            clearTimeout(timeout);
            resolve();
          }
        }, 1);
      });

      const duration = performance.now() - start;
      unsubscribe();

      expect(received).toBe(true);
      expect(duration).toBeLessThan(10);

      benchmarkResults.push({
        name: 'message_bus_pubsub',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1 / (duration / 1000),
        status: duration < 10 ? 'pass' : 'fail',
      });
    });

    it('should handle 1000 messages in <1 second', async () => {
      const messageCount = 1000;
      const received: any[] = [];

      const unsubscribe = messageBus.subscribe('bulk-test', (msg) => {
        received.push(msg);
      });

      const start = performance.now();
      
      // Publish all messages
      for (let i = 0; i < messageCount; i++) {
        await messageBus.publish('bulk-test', { id: i, timestamp: Date.now() });
      }

      // Wait for all messages
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (received.length === messageCount) {
            clearInterval(check);
            resolve();
          }
        }, 1);
      });

      const duration = performance.now() - start;
      unsubscribe();

      expect(received).toHaveLength(messageCount);
      expect(duration).toBeLessThan(1000);

      benchmarkResults.push({
        name: 'message_bus_bulk',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: messageCount / (duration / 1000),
        status: duration < 1000 ? 'pass' : 'fail',
      });
    });
  });

  describe('Agent Workflow Performance', () => {
    it('should execute simple workflow in <200ms', async () => {
      const agent = await agentFabric.createAgent('workflow-test', 'CoordinatorAgent');
      
      const start = performance.now();
      
      // Simulate workflow execution
      await agent.processMessage({
        type: 'workflow',
        action: 'analyze',
        payload: { data: 'test' },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);

      benchmarkResults.push({
        name: 'workflow_execution_simple',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1 / (duration / 1000),
        status: duration < 200 ? 'pass' : 'fail',
      });
    });

    it('should handle multi-agent workflow in <500ms', async () => {
      const coordinator = await agentFabric.createAgent('coordinator', 'CoordinatorAgent');
      const target = await agentFabric.createAgent('target', 'TargetAgent');
      const realization = await agentFabric.createAgent('realization', 'RealizationAgent');

      const start = performance.now();

      // Simulate multi-agent workflow
      const result1 = await coordinator.processMessage({
        type: 'workflow',
        action: 'coordinate',
        payload: { target: 'target-agent' },
      });

      const result2 = await target.processMessage({
        type: 'workflow',
        action: 'analyze',
        payload: { data: result1 },
      });

      await realization.processMessage({
        type: 'workflow',
        action: 'execute',
        payload: { plan: result2 },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);

      benchmarkResults.push({
        name: 'workflow_execution_multiagent',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1 / (duration / 1000),
        status: duration < 500 ? 'pass' : 'fail',
      });
    });
  });

  describe('Memory Performance', () => {
    it('should maintain memory usage under 500MB for 100 agents', async () => {
      const agents = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          agentFabric.createAgent(`memory-test-${i}`, 'CoordinatorAgent')
        )
      );

      const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Perform operations
      for (const agent of agents) {
        await agent.processMessage({
          type: 'test',
          action: 'ping',
          payload: {},
        });
      }

      const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = memoryAfter - memoryBefore;

      expect(memoryAfter).toBeLessThan(500);
      expect(memoryIncrease).toBeLessThan(100);

      benchmarkResults.push({
        name: 'memory_usage_100_agents',
        duration: 0,
        memory: memoryAfter,
        throughput: agents.length,
        status: memoryAfter < 500 ? 'pass' : 'fail',
      });
    });

    it('should clean up resources after agent destruction', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create and destroy agents
      const agents = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          agentFabric.createAgent(`cleanup-test-${i}`, 'CoordinatorAgent')
        )
      );

      // Destroy agents
      for (const agent of agents) {
        await agent.destroy();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // <50MB increase

      benchmarkResults.push({
        name: 'memory_cleanup',
        duration: 0,
        memory: finalMemory / 1024 / 1024,
        throughput: agents.length,
        status: memoryIncrease < 50 * 1024 * 1024 ? 'pass' : 'fail',
      });
    });
  });

  describe('Audit Log Performance', () => {
    it('should log audit events in <5ms', async () => {
      const start = performance.now();
      
      await auditLogService.log({
        userId: 'test-user',
        action: 'agent_performance_test',
        resource: 'benchmark',
        metadata: { test: 'performance' },
        severity: 'info',
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);

      benchmarkResults.push({
        name: 'audit_log_single',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1 / (duration / 1000),
        status: duration < 5 ? 'pass' : 'fail',
      });
    });

    it('should handle 1000 audit logs in <2 seconds', async () => {
      const start = performance.now();
      
      await Promise.all(
        Array.from({ length: 1000 }, (_, i) =>
          auditLogService.log({
            userId: `user-${i}`,
            action: `bulk_action_${i}`,
            resource: `resource-${i}`,
            metadata: { iteration: i },
            severity: i % 10 === 0 ? 'warning' : 'info',
          })
        )
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);

      benchmarkResults.push({
        name: 'audit_log_bulk',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1000 / (duration / 1000),
        status: duration < 2000 ? 'pass' : 'fail',
      });
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regression in agent creation', async () => {
      const baseline = 100; // ms
      const tolerance = 1.2; // 20% tolerance

      const start = performance.now();
      await agentFabric.createAgent('regression-test', 'CoordinatorAgent');
      const duration = performance.now() - start;

      const regression = duration > baseline * tolerance;
      
      expect(regression).toBe(false);
      expect(duration).toBeLessThan(baseline * tolerance);

      if (regression) {
        console.warn(`⚠️ Performance regression detected: ${duration}ms vs ${baseline}ms baseline`);
      }

      benchmarkResults.push({
        name: 'regression_detection',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: 1 / (duration / 1000),
        status: regression ? 'fail' : 'pass',
      });
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const runs = 10;
      const durations: number[] = [];

      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        await agentFabric.createAgent(`consistency-${i}`, 'CoordinatorAgent');
        durations.push(performance.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b) / runs;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      const variance = max - min;

      // Variance should be <50% of average
      expect(variance).toBeLessThan(avg * 0.5);

      benchmarkResults.push({
        name: 'performance_consistency',
        duration: avg,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: runs / (durations.reduce((a, b) => a + b) / 1000),
        status: variance < avg * 0.5 ? 'pass' : 'fail',
      });
    });
  });

  describe('Load Testing', () => {
    it('should handle 1000 concurrent agent operations', async () => {
      const agentCount = 1000;
      const start = performance.now();

      // Create agents
      const agents = await Promise.all(
        Array.from({ length: agentCount }, (_, i) =>
          agentFabric.createAgent(`load-${i}`, 'CoordinatorAgent')
        )
      );

      // Perform concurrent operations
      const operations = await Promise.all(
        agents.map(agent => 
          agent.processMessage({
            type: 'load',
            action: 'test',
            payload: { timestamp: Date.now() },
          })
        )
      );

      const duration = performance.now() - start;

      expect(agents).toHaveLength(agentCount);
      expect(operations).toHaveLength(agentCount);
      expect(duration).toBeLessThan(30000); // 30 seconds max

      benchmarkResults.push({
        name: 'load_test_1000_agents',
        duration,
        memory: process.memoryUsage().heapUsed / 1024 / 1024,
        throughput: agentCount / (duration / 1000),
        status: duration < 30000 ? 'pass' : 'fail',
      });
    });
  });

  // Summary report
  describe('Benchmark Summary', () => {
    it('should generate comprehensive benchmark report', () => {
      if (benchmarkResults.length === 0) {
        console.log('⚠️ No benchmark results to report');
        return;
      }

      const passed = benchmarkResults.filter(r => r.status === 'pass').length;
      const total = benchmarkResults.length;
      const passRate = (passed / total) * 100;

      console.log('\n' + '='.repeat(80));
      console.log('🎯 AGENT PERFORMANCE BENCHMARK REPORT');
      console.log('='.repeat(80));
      
      benchmarkResults.forEach(result => {
        const icon = result.status === 'pass' ? '✅' : '❌';
        console.log(`${icon} ${result.name.padEnd(40)} ${result.duration.toFixed(2)}ms | ${result.throughput.toFixed(0)} ops/s`);
      });

      console.log('='.repeat(80));
      console.log(`📊 Summary: ${passed}/${total} passed (${passRate.toFixed(1)}%)`);
      console.log(`💾 Peak Memory: ${Math.max(...benchmarkResults.map(r => r.memory)).toFixed(2)}MB`);
      console.log('='.repeat(80) + '\n');

      // Assertions
      expect(passRate).toBeGreaterThan(80); // At least 80% of benchmarks should pass
      expect(Math.max(...benchmarkResults.map(r => r.memory))).toBeLessThan(1000); // <1GB peak memory
    });
  });
});