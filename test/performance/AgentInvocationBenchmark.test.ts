/**
 * Agent Invocation Benchmarks
 * 
 * Performance benchmarks for agent invocations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { performanceMonitor } from '../../utils/performance';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const runPerf = process.env.RUN_PERF_TESTS === 'true';
const describeMaybe = runIntegration && runPerf ? describe : describe.skip;

/**
 * Mock Agent for benchmarking
 */
class MockAgent {
  private name: string;
  private processingTime: number;

  constructor(name: string, processingTime: number = 100) {
    this.name = name;
    this.processingTime = processingTime;
  }

  async invoke(input: any): Promise<any> {
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, this.processingTime));
    
    return {
      success: true,
      data: {
        ...input,
        processedBy: this.name,
        timestamp: Date.now()
      }
    };
  }

  async secureInvoke(input: any): Promise<any> {
    // Simulate additional security overhead
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const result = await this.invoke(input);
    
    return {
      ...result,
      confidence_score: 0.85,
      confidence_level: 'high',
      hallucination_check: false
    };
  }
}

/**
 * Agent Orchestrator for benchmarking
 */
class MockOrchestrator {
  private agents: Map<string, MockAgent> = new Map();

  registerAgent(name: string, agent: MockAgent): void {
    this.agents.set(name, agent);
  }

  async invokeAgent(name: string, input: any): Promise<any> {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent not found: ${name}`);
    }
    
    return await agent.invoke(input);
  }

  async invokeSequence(agentNames: string[], input: any): Promise<any> {
    let result = input;
    
    for (const name of agentNames) {
      result = await this.invokeAgent(name, result);
    }
    
    return result;
  }

  async invokeParallel(agentNames: string[], input: any): Promise<any[]> {
    const promises = agentNames.map(name => this.invokeAgent(name, input));
    return await Promise.all(promises);
  }
}

describeMaybe('Agent Invocation Benchmarks', () => {
  let orchestrator: MockOrchestrator;

  beforeEach(() => {
    orchestrator = new MockOrchestrator();
    performanceMonitor.clear();
  });

  describe('Single Agent Invocation', () => {
    it('should benchmark fast agent (< 50ms)', async () => {
      const agent = new MockAgent('FastAgent', 10);
      const iterations = 100;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await agent.invoke({ iteration: i });
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('Fast Agent Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Invocations/Second: ${(iterations / duration * 1000).toFixed(2)}`);
      
      expect(avgDuration).toBeLessThan(50);
    });

    it('should benchmark medium agent (50-200ms)', async () => {
      const agent = new MockAgent('MediumAgent', 100);
      const iterations = 50;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await agent.invoke({ iteration: i });
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('Medium Agent Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeGreaterThan(50);
      expect(avgDuration).toBeLessThan(200);
    });

    it('should benchmark slow agent (> 200ms)', async () => {
      const agent = new MockAgent('SlowAgent', 300);
      const iterations = 20;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await agent.invoke({ iteration: i });
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('Slow Agent Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeGreaterThan(200);
    });
  });

  describe('Secure Invocation Overhead', () => {
    it('should measure security overhead', async () => {
      const agent = new MockAgent('TestAgent', 100);
      const iterations = 50;
      
      // Benchmark normal invocation
      const normalStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await agent.invoke({ iteration: i });
      }
      const normalDuration = Date.now() - normalStart;
      
      // Benchmark secure invocation
      const secureStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await agent.secureInvoke({ iteration: i });
      }
      const secureDuration = Date.now() - secureStart;
      
      const overhead = secureDuration - normalDuration;
      const overheadPercent = (overhead / normalDuration) * 100;
      
      console.log('Security Overhead:');
      console.log(`  Normal: ${normalDuration}ms`);
      console.log(`  Secure: ${secureDuration}ms`);
      console.log(`  Overhead: ${overhead}ms (${overheadPercent.toFixed(2)}%)`);
      
      expect(overheadPercent).toBeLessThan(20); // Less than 20% overhead
    });
  });

  describe('Sequential Agent Invocation', () => {
    it('should benchmark 3-agent sequence', async () => {
      orchestrator.registerAgent('agent1', new MockAgent('Agent1', 50));
      orchestrator.registerAgent('agent2', new MockAgent('Agent2', 50));
      orchestrator.registerAgent('agent3', new MockAgent('Agent3', 50));
      
      const iterations = 20;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await orchestrator.invokeSequence(
          ['agent1', 'agent2', 'agent3'],
          { iteration: i }
        );
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('3-Agent Sequence Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Expected: ~150ms`);
      
      expect(avgDuration).toBeGreaterThan(140);
      expect(avgDuration).toBeLessThan(200);
    });

    it('should benchmark 5-agent sequence', async () => {
      for (let i = 1; i <= 5; i++) {
        orchestrator.registerAgent(`agent${i}`, new MockAgent(`Agent${i}`, 50));
      }
      
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await orchestrator.invokeSequence(
          ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'],
          { iteration: i }
        );
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('5-Agent Sequence Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Expected: ~250ms`);
      
      expect(avgDuration).toBeGreaterThan(240);
      expect(avgDuration).toBeLessThan(300);
    });
  });

  describe('Parallel Agent Invocation', () => {
    it('should benchmark 3-agent parallel', async () => {
      orchestrator.registerAgent('agent1', new MockAgent('Agent1', 100));
      orchestrator.registerAgent('agent2', new MockAgent('Agent2', 100));
      orchestrator.registerAgent('agent3', new MockAgent('Agent3', 100));
      
      const iterations = 20;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await orchestrator.invokeParallel(
          ['agent1', 'agent2', 'agent3'],
          { iteration: i }
        );
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('3-Agent Parallel Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Expected: ~100ms (parallel speedup)`);
      
      expect(avgDuration).toBeLessThan(150); // Should be close to single agent time
    });

    it('should benchmark 10-agent parallel', async () => {
      for (let i = 1; i <= 10; i++) {
        orchestrator.registerAgent(`agent${i}`, new MockAgent(`Agent${i}`, 100));
      }
      
      const agentNames = Array.from({ length: 10 }, (_, i) => `agent${i + 1}`);
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await orchestrator.invokeParallel(agentNames, { iteration: i });
      }
      
      const duration = Date.now() - startTime;
      const avgDuration = duration / iterations;
      
      console.log('10-Agent Parallel Benchmark:');
      console.log(`  Iterations: ${iterations}`);
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(200);
    });
  });

  describe('Concurrent Invocations', () => {
    it('should handle 50 concurrent invocations', async () => {
      const agent = new MockAgent('ConcurrentAgent', 100);
      const concurrentCount = 50;
      
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({ id: i })
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      console.log('50 Concurrent Invocations:');
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Invocations/Second: ${(concurrentCount / duration * 1000).toFixed(2)}`);
      
      expect(results.length).toBe(concurrentCount);
      expect(duration).toBeLessThan(200); // Should complete in parallel
    });

    it('should handle 100 concurrent invocations', async () => {
      const agent = new MockAgent('ConcurrentAgent', 100);
      const concurrentCount = 100;
      
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        agent.invoke({ id: i })
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      console.log('100 Concurrent Invocations:');
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Invocations/Second: ${(concurrentCount / duration * 1000).toFixed(2)}`);
      
      expect(results.length).toBe(concurrentCount);
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should measure maximum throughput', async () => {
      const agent = new MockAgent('ThroughputAgent', 10);
      const duration = 5000; // 5 seconds
      let invocations = 0;
      
      const startTime = Date.now();
      
      while (Date.now() - startTime < duration) {
        await agent.invoke({ id: invocations });
        invocations++;
      }
      
      const actualDuration = Date.now() - startTime;
      const throughput = (invocations / actualDuration) * 1000;
      
      console.log('Maximum Throughput:');
      console.log(`  Duration: ${actualDuration}ms`);
      console.log(`  Invocations: ${invocations}`);
      console.log(`  Throughput: ${throughput.toFixed(2)} invocations/second`);
      
      expect(throughput).toBeGreaterThan(50);
    });

    it('should measure sustained throughput', async () => {
      const agent = new MockAgent('SustainedAgent', 50);
      const duration = 10000; // 10 seconds
      const batchSize = 10;
      let totalInvocations = 0;
      
      const startTime = Date.now();
      
      while (Date.now() - startTime < duration) {
        const promises = Array.from({ length: batchSize }, (_, i) =>
          agent.invoke({ id: totalInvocations + i })
        );
        
        await Promise.all(promises);
        totalInvocations += batchSize;
      }
      
      const actualDuration = Date.now() - startTime;
      const throughput = (totalInvocations / actualDuration) * 1000;
      
      console.log('Sustained Throughput:');
      console.log(`  Duration: ${actualDuration}ms`);
      console.log(`  Invocations: ${totalInvocations}`);
      console.log(`  Throughput: ${throughput.toFixed(2)} invocations/second`);
      
      expect(throughput).toBeGreaterThan(100);
    });
  });

  describe('Latency Percentiles', () => {
    it('should measure latency distribution', async () => {
      const agent = new MockAgent('LatencyAgent', 100);
      const iterations = 100;
      const latencies: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await agent.invoke({ id: i });
        latencies.push(Date.now() - start);
      }
      
      latencies.sort((a, b) => a - b);
      
      const p50 = latencies[Math.floor(iterations * 0.50)];
      const p75 = latencies[Math.floor(iterations * 0.75)];
      const p90 = latencies[Math.floor(iterations * 0.90)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const p99 = latencies[Math.floor(iterations * 0.99)];
      const min = latencies[0];
      const max = latencies[iterations - 1];
      const avg = latencies.reduce((sum, l) => sum + l, 0) / iterations;
      
      console.log('Latency Distribution:');
      console.log(`  Min: ${min}ms`);
      console.log(`  P50: ${p50}ms`);
      console.log(`  P75: ${p75}ms`);
      console.log(`  P90: ${p90}ms`);
      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);
      console.log(`  Max: ${max}ms`);
      console.log(`  Avg: ${avg.toFixed(2)}ms`);
      
      expect(p95).toBeLessThan(150);
      expect(p99).toBeLessThan(200);
    });
  });

  describe('Performance Targets', () => {
    it('should meet all performance targets', async () => {
      const targets = [
        {
          name: 'Fast Agent',
          agent: new MockAgent('Fast', 10),
          iterations: 100,
          targetAvg: 50,
          targetP95: 100
        },
        {
          name: 'Medium Agent',
          agent: new MockAgent('Medium', 100),
          iterations: 50,
          targetAvg: 150,
          targetP95: 200
        },
        {
          name: 'Slow Agent',
          agent: new MockAgent('Slow', 300),
          iterations: 20,
          targetAvg: 350,
          targetP95: 400
        }
      ];
      
      console.log('Performance Targets:');
      
      for (const target of targets) {
        const latencies: number[] = [];
        
        for (let i = 0; i < target.iterations; i++) {
          const start = Date.now();
          await target.agent.invoke({ id: i });
          latencies.push(Date.now() - start);
        }
        
        latencies.sort((a, b) => a - b);
        const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        
        const avgPass = avg < target.targetAvg;
        const p95Pass = p95 < target.targetP95;
        
        console.log(`  ${target.name}:`);
        console.log(`    Avg: ${avg.toFixed(2)}ms (target: ${target.targetAvg}ms) ${avgPass ? 'PASS' : 'FAIL'}`);
        console.log(`    P95: ${p95}ms (target: ${target.targetP95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
        
        expect(avg).toBeLessThan(target.targetAvg);
        expect(p95).toBeLessThan(target.targetP95);
      }
    });
  });
});
