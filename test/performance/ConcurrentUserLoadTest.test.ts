/**
 * Concurrent User Load Testing
 * 
 * Tests system behavior with 100 concurrent users performing various operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getWorkflowLifecycleIntegration } from '../../services/WorkflowLifecycleIntegration';
import { getSDUIStateManager } from '../../lib/state';
import { performanceMonitor } from '../../utils/performance';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const runPerf = process.env.RUN_PERF_TESTS === 'true';
const describeMaybe = runIntegration && runPerf ? describe : describe.skip;

// Mock Supabase client
const mockSupabase = createClient('https://test.supabase.co', 'test-key');

/**
 * User simulation class
 */
class SimulatedUser {
  private userId: string;
  private sessionId: string;
  private stateManager = getSDUIStateManager({ supabase: mockSupabase });
  private workflow = getWorkflowLifecycleIntegration(mockSupabase);

  constructor(userId: string) {
    this.userId = userId;
    this.sessionId = `session-${userId}-${Date.now()}`;
  }

  /**
   * Simulate user workflow
   */
  async simulateWorkflow(): Promise<{
    success: boolean;
    duration: number;
    operations: number;
  }> {
    const startTime = Date.now();
    let operations = 0;

    try {
      // Operation 1: Set initial state
      this.stateManager.set(`user.${this.userId}.profile`, {
        name: `User ${this.userId}`,
        email: `user${this.userId}@test.com`
      });
      operations++;

      // Operation 2: Create workflow
      await this.workflow.executeWorkflow(
        this.userId,
        { companyName: `Company ${this.userId}` },
        { stopStage: 'opportunity', sessionId: this.sessionId }
      );
      operations++;

      // Operation 3: Update state
      this.stateManager.update(`user.${this.userId}.profile`, {
        lastActivity: Date.now()
      });
      operations++;

      // Operation 4: Read state
      const profile = this.stateManager.get(`user.${this.userId}.profile`);
      operations++;

      // Operation 5: Subscribe to changes
      const unsubscribe = this.stateManager.subscribe(
        `user.${this.userId}.profile`,
        () => {}
      );
      operations++;

      // Cleanup
      unsubscribe();

      return {
        success: true,
        duration: Date.now() - startTime,
        operations
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        operations
      };
    }
  }

  /**
   * Simulate read-heavy operations
   */
  async simulateReads(count: number = 10): Promise<number> {
    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
      this.stateManager.get(`user.${this.userId}.data.${i}`);
    }

    return Date.now() - startTime;
  }

  /**
   * Simulate write-heavy operations
   */
  async simulateWrites(count: number = 10): Promise<number> {
    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
      this.stateManager.set(`user.${this.userId}.data.${i}`, {
        value: i,
        timestamp: Date.now()
      });
    }

    return Date.now() - startTime;
  }

  /**
   * Cleanup user data
   */
  cleanup(): void {
    this.stateManager.delete(`user.${this.userId}.profile`);
  }
}

describeMaybe('Concurrent User Load Testing', () => {
  beforeAll(() => {
    performanceMonitor.clear();
  });

  afterAll(() => {
    const report = performanceMonitor.generateReport();
    console.log('Performance Report:', JSON.stringify(report, null, 2));
  });

  describe('100 Concurrent Users', () => {
    it('should handle 100 concurrent user workflows', async () => {
      const userCount = 100;
      const users = Array.from(
        { length: userCount },
        (_, i) => new SimulatedUser(`user-${i}`)
      );

      const startTime = Date.now();

      // Execute all user workflows concurrently
      const results = await Promise.allSettled(
        users.map(user => user.simulateWorkflow())
      );

      const duration = Date.now() - startTime;

      // Analyze results
      const successful = results.filter(
        r => r.status === 'fulfilled' && r.value.success
      ).length;
      const failed = userCount - successful;
      const successRate = successful / userCount;

      const durations = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value.duration);

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      // Calculate percentiles
      const sortedDurations = durations.sort((a, b) => a - b);
      const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)];
      const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
      const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)];

      console.log('100 Concurrent Users Test Results:');
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  Successful: ${successful}, Failed: ${failed}`);
      console.log(`  Avg Duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min Duration: ${minDuration}ms`);
      console.log(`  Max Duration: ${maxDuration}ms`);
      console.log(`  P50: ${p50}ms`);
      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);

      // Assertions
      expect(successRate).toBeGreaterThan(0.90); // 90% success rate
      expect(duration).toBeLessThan(60000); // Complete within 60 seconds
      expect(p95).toBeLessThan(10000); // P95 under 10 seconds
      expect(p99).toBeLessThan(15000); // P99 under 15 seconds

      // Cleanup
      users.forEach(user => user.cleanup());
    }, 120000); // 2 minute timeout

    it('should handle 100 concurrent read-heavy users', async () => {
      const userCount = 100;
      const readsPerUser = 50;
      const users = Array.from(
        { length: userCount },
        (_, i) => new SimulatedUser(`reader-${i}`)
      );

      const startTime = Date.now();

      const results = await Promise.all(
        users.map(user => user.simulateReads(readsPerUser))
      );

      const duration = Date.now() - startTime;
      const totalReads = userCount * readsPerUser;
      const readsPerSecond = (totalReads / duration) * 1000;

      console.log('Read-Heavy Load Test Results:');
      console.log(`  Total Reads: ${totalReads}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Reads/Second: ${readsPerSecond.toFixed(2)}`);

      expect(readsPerSecond).toBeGreaterThan(1000); // At least 1000 reads/sec
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds

      users.forEach(user => user.cleanup());
    }, 30000);

    it('should handle 100 concurrent write-heavy users', async () => {
      const userCount = 100;
      const writesPerUser = 20;
      const users = Array.from(
        { length: userCount },
        (_, i) => new SimulatedUser(`writer-${i}`)
      );

      const startTime = Date.now();

      const results = await Promise.all(
        users.map(user => user.simulateWrites(writesPerUser))
      );

      const duration = Date.now() - startTime;
      const totalWrites = userCount * writesPerUser;
      const writesPerSecond = (totalWrites / duration) * 1000;

      console.log('Write-Heavy Load Test Results:');
      console.log(`  Total Writes: ${totalWrites}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Writes/Second: ${writesPerSecond.toFixed(2)}`);

      expect(writesPerSecond).toBeGreaterThan(500); // At least 500 writes/sec
      expect(duration).toBeLessThan(15000); // Complete within 15 seconds

      users.forEach(user => user.cleanup());
    }, 30000);
  });

  describe('Ramp-Up Testing', () => {
    it('should handle gradual user ramp-up', async () => {
      const maxUsers = 100;
      const rampUpTime = 10000; // 10 seconds
      const usersPerSecond = maxUsers / (rampUpTime / 1000);

      const users: SimulatedUser[] = [];
      const results: Promise<any>[] = [];
      const startTime = Date.now();

      // Gradually add users
      for (let i = 0; i < maxUsers; i++) {
        const user = new SimulatedUser(`rampup-${i}`);
        users.push(user);
        results.push(user.simulateWorkflow());

        // Wait before adding next user
        const delay = 1000 / usersPerSecond;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Wait for all to complete
      const allResults = await Promise.allSettled(results);
      const duration = Date.now() - startTime;

      const successful = allResults.filter(
        r => r.status === 'fulfilled' && r.value.success
      ).length;
      const successRate = successful / maxUsers;

      console.log('Ramp-Up Test Results:');
      console.log(`  Total Duration: ${duration}ms`);
      console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  Users/Second: ${usersPerSecond.toFixed(2)}`);

      expect(successRate).toBeGreaterThan(0.90);
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds

      users.forEach(user => user.cleanup());
    }, 60000);
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const duration = 30000; // 30 seconds
      const concurrentUsers = 50;
      const operationsPerUser = 10;

      const startTime = Date.now();
      let totalOperations = 0;
      let successfulOperations = 0;

      while (Date.now() - startTime < duration) {
        const users = Array.from(
          { length: concurrentUsers },
          (_, i) => new SimulatedUser(`sustained-${i}-${Date.now()}`)
        );

        const results = await Promise.allSettled(
          users.map(user => user.simulateWorkflow())
        );

        totalOperations += concurrentUsers;
        successfulOperations += results.filter(
          r => r.status === 'fulfilled' && r.value.success
        ).length;

        users.forEach(user => user.cleanup());

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const actualDuration = Date.now() - startTime;
      const successRate = successfulOperations / totalOperations;
      const operationsPerSecond = (totalOperations / actualDuration) * 1000;

      console.log('Sustained Load Test Results:');
      console.log(`  Duration: ${actualDuration}ms`);
      console.log(`  Total Operations: ${totalOperations}`);
      console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`  Operations/Second: ${operationsPerSecond.toFixed(2)}`);

      expect(successRate).toBeGreaterThan(0.85);
      expect(operationsPerSecond).toBeGreaterThan(10);
    }, 60000);
  });

  describe('Spike Testing', () => {
    it('should handle sudden traffic spike', async () => {
      // Baseline: 10 users
      const baselineUsers = 10;
      const baselineResults = await Promise.all(
        Array.from({ length: baselineUsers }, (_, i) =>
          new SimulatedUser(`baseline-${i}`).simulateWorkflow()
        )
      );

      const baselineAvg = baselineResults.reduce((sum, r) => sum + r.duration, 0) / baselineUsers;

      // Spike: 100 users
      const spikeUsers = 100;
      const spikeStartTime = Date.now();

      const spikeResults = await Promise.all(
        Array.from({ length: spikeUsers }, (_, i) =>
          new SimulatedUser(`spike-${i}`).simulateWorkflow()
        )
      );

      const spikeDuration = Date.now() - spikeStartTime;
      const spikeSuccessful = spikeResults.filter(r => r.success).length;
      const spikeSuccessRate = spikeSuccessful / spikeUsers;
      const spikeAvg = spikeResults.reduce((sum, r) => sum + r.duration, 0) / spikeUsers;

      console.log('Spike Test Results:');
      console.log(`  Baseline Avg: ${baselineAvg.toFixed(2)}ms`);
      console.log(`  Spike Avg: ${spikeAvg.toFixed(2)}ms`);
      console.log(`  Degradation: ${((spikeAvg / baselineAvg - 1) * 100).toFixed(2)}%`);
      console.log(`  Spike Success Rate: ${(spikeSuccessRate * 100).toFixed(2)}%`);

      expect(spikeSuccessRate).toBeGreaterThan(0.80); // 80% success during spike
      expect(spikeAvg).toBeLessThan(baselineAvg * 3); // Less than 3x degradation
    }, 120000);
  });
});
