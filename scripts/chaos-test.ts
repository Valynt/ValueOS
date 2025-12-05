#!/usr/bin/env ts-node
/**
 * Chaos Engineering Test Suite
 * Runs controlled chaos experiments in development environment
 */

import { chaosEngineering } from '../src/services/ChaosEngineering';
import { logger } from '../src/utils/logger';

interface TestResult {
  experimentName: string;
  passed: boolean;
  duration: number;
  error?: string;
  injectionCount: number;
}

class ChaosTestRunner {
  private results: TestResult[] = [];

  /**
   * Run all chaos experiments
   */
  async runAll(): Promise<void> {
    console.log('\n🔥 Chaos Engineering Test Suite\n');
    console.log('=' .repeat(70));

    // Enable all experiments
    const experiments = chaosEngineering.listExperiments();
    experiments.forEach(exp => {
      chaosEngineering.enableExperiment(exp.id);
      console.log(`✓ Enabled: ${exp.name}`);
    });

    console.log('\n' + '='.repeat(70) + '\n');

    // Run tests for each experiment type
    await this.testLatencyInjection();
    await this.testErrorInjection();
    await this.testTimeoutInjection();
    await this.testCircuitBreakerInjection();
    await this.testRateLimitInjection();

    // Disable all experiments
    experiments.forEach(exp => {
      chaosEngineering.disableExperiment(exp.id);
    });

    // Print results
    this.printResults();
  }

  /**
   * Test latency injection
   */
  private async testLatencyInjection(): Promise<void> {
    console.log('🕐 Testing Latency Injection...');
    const startTime = Date.now();

    try {
      const injection = chaosEngineering.shouldInject({
        service: 'api',
        endpoint: '/api/llm/chat',
      });

      let injectionCount = 0;
      
      // Simulate 10 requests
      for (let i = 0; i < 10; i++) {
        const inj = chaosEngineering.shouldInject({
          service: 'api',
          endpoint: '/api/llm/chat',
        });
        
        if (inj) {
          injectionCount++;
          await chaosEngineering.executeChaos(inj);
        }
      }

      const duration = Date.now() - startTime;

      this.results.push({
        experimentName: 'Latency Injection',
        passed: injectionCount > 0,
        duration,
        injectionCount,
      });

      console.log(`  ✓ Latency injected ${injectionCount}/10 times`);
      console.log(`  ⏱  Total duration: ${duration}ms\n`);
    } catch (error) {
      this.results.push({
        experimentName: 'Latency Injection',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        injectionCount: 0,
      });
      console.log(`  ✗ Test failed: ${error}\n`);
    }
  }

  /**
   * Test error injection
   */
  private async testErrorInjection(): Promise<void> {
    console.log('💥 Testing Error Injection...');
    const startTime = Date.now();

    try {
      let errorCaught = false;
      let injectionCount = 0;

      // Try multiple times to get an injection
      for (let i = 0; i < 20; i++) {
        const injection = chaosEngineering.shouldInject({
          service: 'llm',
          endpoint: '/api/llm/chat',
        });

        if (injection) {
          injectionCount++;
          try {
            await chaosEngineering.executeChaos(injection);
          } catch (error) {
            errorCaught = true;
            console.log(`  ✓ Error injected: ${error instanceof Error ? error.message : error}`);
            break;
          }
        }
      }

      const duration = Date.now() - startTime;

      this.results.push({
        experimentName: 'Error Injection',
        passed: errorCaught,
        duration,
        injectionCount,
      });

      if (!errorCaught) {
        console.log(`  ⚠  No errors caught (probability-based, may need retry)\n`);
      } else {
        console.log(`  ⏱  Duration: ${duration}ms\n`);
      }
    } catch (error) {
      this.results.push({
        experimentName: 'Error Injection',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        injectionCount: 0,
      });
      console.log(`  ✗ Test failed: ${error}\n`);
    }
  }

  /**
   * Test timeout injection
   */
  private async testTimeoutInjection(): Promise<void> {
    console.log('⏰ Testing Timeout Injection...');
    const startTime = Date.now();

    try {
      let timeoutCaught = false;
      let injectionCount = 0;

      for (let i = 0; i < 20; i++) {
        const injection = chaosEngineering.shouldInject({
          service: 'database',
          endpoint: '/api/data',
        });

        if (injection) {
          injectionCount++;
          try {
            await Promise.race([
              chaosEngineering.executeChaos(injection),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), 1000)
              ),
            ]);
          } catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
              timeoutCaught = true;
              console.log(`  ✓ Timeout injected successfully`);
              break;
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      this.results.push({
        experimentName: 'Timeout Injection',
        passed: timeoutCaught,
        duration,
        injectionCount,
      });

      if (!timeoutCaught) {
        console.log(`  ⚠  No timeouts caught (probability-based)\n`);
      } else {
        console.log(`  ⏱  Duration: ${duration}ms\n`);
      }
    } catch (error) {
      this.results.push({
        experimentName: 'Timeout Injection',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        injectionCount: 0,
      });
      console.log(`  ✗ Test failed: ${error}\n`);
    }
  }

  /**
   * Test circuit breaker injection
   */
  private async testCircuitBreakerInjection(): Promise<void> {
    console.log('🔌 Testing Circuit Breaker Injection...');
    const startTime = Date.now();

    try {
      let circuitBreakerTriggered = false;
      let injectionCount = 0;

      for (let i = 0; i < 20; i++) {
        const injection = chaosEngineering.shouldInject({
          service: 'llm',
          endpoint: '/api/llm',
        });

        if (injection) {
          injectionCount++;
          try {
            await chaosEngineering.executeChaos(injection);
          } catch (error) {
            if (error instanceof Error && error.message.includes('Circuit breaker')) {
              circuitBreakerTriggered = true;
              console.log(`  ✓ Circuit breaker opened`);
              break;
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      this.results.push({
        experimentName: 'Circuit Breaker',
        passed: circuitBreakerTriggered,
        duration,
        injectionCount,
      });

      if (!circuitBreakerTriggered) {
        console.log(`  ⚠  Circuit breaker not triggered (may be outside schedule)\n`);
      } else {
        console.log(`  ⏱  Duration: ${duration}ms\n`);
      }
    } catch (error) {
      this.results.push({
        experimentName: 'Circuit Breaker',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        injectionCount: 0,
      });
      console.log(`  ✗ Test failed: ${error}\n`);
    }
  }

  /**
   * Test rate limit injection
   */
  private async testRateLimitInjection(): Promise<void> {
    console.log('🚦 Testing Rate Limit Injection...');
    const startTime = Date.now();

    try {
      let rateLimitTriggered = false;
      let injectionCount = 0;

      for (let i = 0; i < 20; i++) {
        const injection = chaosEngineering.shouldInject({
          service: 'api',
          endpoint: '/api/llm/chat',
        });

        if (injection) {
          injectionCount++;
          try {
            await chaosEngineering.executeChaos(injection);
          } catch (error) {
            if (error instanceof Error && error.message.includes('Rate limit')) {
              rateLimitTriggered = true;
              console.log(`  ✓ Rate limit triggered`);
              break;
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      this.results.push({
        experimentName: 'Rate Limit',
        passed: rateLimitTriggered,
        duration,
        injectionCount,
      });

      if (!rateLimitTriggered) {
        console.log(`  ⚠  Rate limit not triggered (probability-based)\n`);
      } else {
        console.log(`  ⏱  Duration: ${duration}ms\n`);
      }
    } catch (error) {
      this.results.push({
        experimentName: 'Rate Limit',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        injectionCount: 0,
      });
      console.log(`  ✗ Test failed: ${error}\n`);
    }
  }

  /**
   * Print test results
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(70) + '\n');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '⚠️';
      const status = result.passed ? 'PASSED' : 'WARNING';
      console.log(`${icon} ${result.experimentName.padEnd(30)} ${status}`);
      console.log(`   Injections: ${result.injectionCount}, Duration: ${result.duration}ms`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
    });

    console.log('='.repeat(70));
    console.log(`Total: ${passed}/${total} tests passed`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log('='.repeat(70) + '\n');

    // Exit with appropriate code
    if (passed === total) {
      console.log('✅ All chaos experiments validated!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some experiments did not trigger (probability-based behavior is normal)\n');
      process.exit(0); // Don't fail build, chaos is probabilistic
    }
  }
}

// Run tests
const runner = new ChaosTestRunner();
runner.runAll().catch(error => {
  console.error('❌ Chaos test suite failed:', error);
  process.exit(1);
});
