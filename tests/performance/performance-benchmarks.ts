/**
 * Task #038: Performance Tuning & Benchmarks
 */

import { performance } from 'perf_hooks';
import { renderPage } from '../../src/sdui/engine/renderPage';
import { agentMemory } from '../../src/lib/agent-fabric/AgentMemory';
import { sduiSanitizer } from '../../src/lib/security/SDUISanitizer';

interface BenchmarkResult {
  name: string;
  iterations: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  opsPerSecond: number;
}

class PerformanceBenchmark {
  async runBenchmark(name: string, fn: () => Promise<void> | void, iterations = 100): Promise<BenchmarkResult> {
    const times: number[] = [];

    // Warmup
    for (let i = 0; i < 10; i++) {
      await fn();
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    times.sort((a, b) => a - b);

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const p95Time = times[Math.floor(times.length * 0.95)];
    const p99Time = times[Math.floor(times.length * 0.99)];
    const opsPerSecond = 1000 / avgTime;

    return {
      name,
      iterations,
      avgTime,
      minTime,
      maxTime,
      p95Time,
      p99Time,
      opsPerSecond,
    };
  }

  printResults(results: BenchmarkResult[]): void {
    console.log('\n=== Performance Benchmark Results ===\n');
    
    results.forEach((result) => {
      console.log(`${result.name}:`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Avg: ${result.avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max: ${result.maxTime.toFixed(2)}ms`);
      console.log(`  P95: ${result.p95Time.toFixed(2)}ms`);
      console.log(`  P99: ${result.p99Time.toFixed(2)}ms`);
      console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(0)}`);
      console.log('');
    });
  }
}

// Benchmark suite
async function runAllBenchmarks() {
  const benchmark = new PerformanceBenchmark();
  const results: BenchmarkResult[] = [];

  // SDUI Rendering
  const samplePage = {
    type: 'page' as const,
    version: 1,
    sections: [
      {
        type: 'component' as const,
        component: 'TestComponent',
        version: 1,
        props: { data: 'test' },
      },
    ],
    metadata: { theme: 'dark' as const, experienceId: 'bench' },
  };

  results.push(
    await benchmark.runBenchmark(
      'SDUI Page Rendering',
      () => {
        renderPage(samplePage);
      },
      1000
    )
  );

  // SDUI Sanitization
  results.push(
    await benchmark.runBenchmark(
      'SDUI Sanitization',
      () => {
        sduiSanitizer.sanitizePage(samplePage);
      },
      1000
    )
  );

  // JSON serialization (common operation)
  const largeObject = {
    sections: Array(100).fill({
      type: 'component',
      component: 'Card',
      props: { title: 'Test', data: Array(50).fill({ id: 1, value: 'test' }) },
    }),
  };

  results.push(
    await benchmark.runBenchmark(
      'JSON Serialization (Large)',
      () => {
        JSON.stringify(largeObject);
      },
      1000
    )
  );

  benchmark.printResults(results);
}

if (require.main === module) {
  runAllBenchmarks().catch(console.error);
}

export { PerformanceBenchmark, runAllBenchmarks };
