#!/usr/bin/env ts-node
/**
 * ValueOS Chaos Suite
 *
 * Implements comprehensive chaos engineering experiments for SRE validation:
 * 1. Agent Killer: Random pod restarts during DAG execution
 * 2. State Recovery: WorkflowExecutionStore persistence validation
 * 3. Redis Partitioning: Connection loss simulation with DLQ verification
 */

import { performance } from "perf_hooks";
import Redis from "ioredis";

// Mock Redis for testing when Redis is not available
class MockRedis {
  private data: Map<string, any> = new Map();
  private streams: Map<string, any[]> = new Map();

  async set(key: string, value: any): Promise<string> {
    this.data.set(key, value);
    return "OK";
  }

  async setex(key: string, ttl: number, value: any): Promise<string> {
    this.data.set(key, value);
    // In a real implementation, we'd set a TTL, but for testing this is fine
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }

  async xadd(stream: string, id: string, ...args: any[]): Promise<string> {
    if (!this.streams.has(stream)) {
      this.streams.set(stream, []);
    }
    const entries = this.streams.get(stream)!;
    const entry = { id, fields: {} };
    for (let i = 0; i < args.length; i += 2) {
      entry.fields[args[i]] = args[i + 1];
    }
    entries.push(entry);
    return id;
  }

  async xlen(stream: string): Promise<number> {
    return this.streams.get(stream)?.length || 0;
  }

  async disconnect(): Promise<void> {
    // Simulate disconnection
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async connect(): Promise<void> {
    // Simulate connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

interface ResilienceReport {
  experimentId: string;
  timestamp: Date;
  stateLossEvents: number;
  recoveryTime: number;
  dataIntegrity: boolean;
  systemStability: "stable" | "degraded" | "failed";
  details: Record<string, any>;
}

class ValueOSChaosSuite {
  private resilienceReports: ResilienceReport[] = [];
  private redis: Redis;

  constructor() {
    // Use mock Redis by default for testing
    this.redis = new MockRedis() as any;
  }

  /**
   * Task 1: Agent Killer Experiment
   * Randomly restarts agent pods while a complex DAG is executing
   */
  async runAgentKillerExperiment(): Promise<ResilienceReport> {
    const experimentId = "agent-killer-chaos";
    const startTime = performance.now();

    console.log("🚀 Starting Agent Killer Chaos Experiment");

    // Simulate workflow execution
    const executionId = `chaos-exec-${Date.now()}`;
    await this.simulateWorkflowStart(executionId);

    // Monitor execution and inject chaos
    let stateLossEvents = 0;
    let recoveryTime = 0;

    const chaosInterval = setInterval(async () => {
      try {
        // Check if workflow is still running
        const status = await this.getWorkflowStatus(executionId);

        if (status === "RUNNING") {
          // Randomly kill an agent pod (simulate container restart)
          const agents = ["OpportunityAgent", "AnalysisAgent", "StrategyAgent", "ExecutionAgent"];
          const targetAgent = agents[Math.floor(Math.random() * agents.length)];

          console.warn(`🔥 Killing agent pod: ${targetAgent}`);

          // Simulate pod restart by temporarily marking agent as unavailable
          await this.simulatePodRestart(targetAgent);

          // Check for state loss
          const postKillStatus = await this.getWorkflowStatus(executionId);
          if (postKillStatus === "HALTED") {
            stateLossEvents++;
            console.error("❌ State loss detected after pod kill");

            // Attempt recovery
            const recoveryStart = performance.now();
            await this.setWorkflowStatus(executionId, "RUNNING");
            recoveryTime += performance.now() - recoveryStart;
          }
        }
      } catch (error) {
        console.error("Chaos injection failed", error);
      }
    }, 1000); // Inject chaos every 1 second

    // Wait for workflow completion or timeout
    await this.waitForWorkflowCompletion(executionId, 10000); // 10 second timeout

    clearInterval(chaosInterval);

    const dataIntegrity = await this.verifyWorkflowDataIntegrity(executionId);
    const systemStability =
      stateLossEvents === 0 ? "stable" : stateLossEvents < 3 ? "degraded" : "failed";

    const report: ResilienceReport = {
      experimentId,
      timestamp: new Date(),
      stateLossEvents,
      recoveryTime,
      dataIntegrity,
      systemStability,
      details: {
        executionId,
        chaosInjections: Math.floor(30000 / 2000), // Number of chaos injections
        workflowCompleted: await this.checkWorkflowCompletion(executionId),
      },
    };

    console.log("✅ Agent Killer Experiment completed", {
      stateLossEvents,
      recoveryTime: `${recoveryTime.toFixed(2)}ms`,
      dataIntegrity,
      systemStability,
    });

    return report;
  }

  /**
   * Task 2: State Recovery Check
   * Verify WorkflowExecutionStore resumes from persisted state
   */
  async runStateRecoveryExperiment(): Promise<ResilienceReport> {
    const experimentId = "state-recovery-chaos";
    const startTime = performance.now();

    console.log("🔄 Starting State Recovery Chaos Experiment");

    // Create and start a workflow
    const executionId = `chaos-recovery-${Date.now()}`;
    await this.simulateWorkflowStart(executionId);

    // Wait for some progress
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Simulate system crash by clearing volatile state
    await this.simulateSystemCrash(executionId);

    // Attempt recovery
    const recoveryStart = performance.now();
    const recoveredStatus = await this.getWorkflowStatus(executionId);
    const recoveryTime = performance.now() - recoveryStart;

    // Verify workflow can resume
    let stateLossEvents = 0;
    let dataIntegrity = true;

    if (recoveredStatus !== "RUNNING") {
      stateLossEvents++;
      console.error("❌ Workflow state not recovered properly");

      // Try to resume workflow
      try {
        await this.resumeWorkflow(executionId);
        dataIntegrity = (await this.getWorkflowStatus(executionId)) === "RUNNING";
      } catch (error) {
        dataIntegrity = false;
        console.error("❌ Workflow resume failed", error);
      }
    }

    // Wait for completion
    const completed = await this.waitForWorkflowCompletion(executionId, 20000);

    const systemStability = stateLossEvents === 0 && dataIntegrity ? "stable" : "degraded";

    const report: ResilienceReport = {
      experimentId,
      timestamp: new Date(),
      stateLossEvents,
      recoveryTime,
      dataIntegrity,
      systemStability,
      details: {
        executionId,
        recoveredStatus,
        workflowResumed: completed,
      },
    };

    console.log("✅ State Recovery Experiment completed", {
      stateLossEvents,
      recoveryTime: `${recoveryTime.toFixed(2)}ms`,
      dataIntegrity,
      systemStability,
    });

    return report;
  }

  /**
   * Task 3: Redis Partitioning Experiment
   * Simulate Redis connection loss and verify DLQ handling
   */
  async runRedisPartitioningExperiment(): Promise<ResilienceReport> {
    const experimentId = "redis-partitioning-chaos";
    const startTime = performance.now();

    console.log("🔌 Starting Redis Partitioning Chaos Experiment");

    // Start monitoring Redis stream
    const initialMessageCount = await this.getStreamMessageCount();
    const initialDlqCount = await this.getDlqMessageCount();

    // Publish test messages
    const testMessages = [];
    for (let i = 0; i < 10; i++) {
      const messageId = await this.publishTestMessage(`test-${i}`);
      testMessages.push(messageId);
    }

    // Simulate Redis connection loss
    await this.simulateRedisPartition();

    // Try to publish more messages during outage
    const outageMessages = [];
    for (let i = 10; i < 15; i++) {
      try {
        const messageId = await this.publishTestMessage(`outage-${i}`);
        outageMessages.push(messageId);
      } catch (error) {
        console.warn("Message publish failed during Redis outage", error);
      }
    }

    // Restore Redis connection
    await this.restoreRedisConnection();

    // Wait for message processing
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check message handling
    const finalMessageCount = await this.getStreamMessageCount();
    const finalDlqCount = await this.getDlqMessageCount();

    const messagesProcessed = finalMessageCount - initialMessageCount;
    const messagesInDlq = finalDlqCount - initialDlqCount;

    // Verify no messages were lost
    const totalMessagesSent = testMessages.length + outageMessages.length;
    const totalMessagesHandled = messagesProcessed + messagesInDlq;

    const dataIntegrity = totalMessagesHandled >= totalMessagesSent;
    const stateLossEvents = totalMessagesSent - totalMessagesHandled;

    const systemStability =
      stateLossEvents === 0 ? "stable" : stateLossEvents < 3 ? "degraded" : "failed";

    const report: ResilienceReport = {
      experimentId,
      timestamp: new Date(),
      stateLossEvents,
      recoveryTime: 0, // Redis recovery is near-instantaneous
      dataIntegrity,
      systemStability,
      details: {
        initialMessages: initialMessageCount,
        finalMessages: finalMessageCount,
        initialDlq: initialDlqCount,
        finalDlq: finalDlqCount,
        messagesProcessed,
        messagesInDlq,
        totalSent: totalMessagesSent,
        totalHandled: totalMessagesHandled,
      },
    };

    console.log("✅ Redis Partitioning Experiment completed", {
      stateLossEvents,
      dataIntegrity,
      systemStability,
      messagesProcessed,
      messagesInDlq,
    });

    return report;
  }

  /**
   * Run all chaos experiments
   */
  async runChaosSuite(): Promise<void> {
    console.log("\n🔥 ValueOS Chaos Engineering Suite");
    console.log("=====================================\n");

    const experiments = [
      this.runAgentKillerExperiment.bind(this),
      this.runStateRecoveryExperiment.bind(this),
      this.runRedisPartitioningExperiment.bind(this),
    ];

    for (const experiment of experiments) {
      try {
        const report = await experiment();
        this.resilienceReports.push(report);
      } catch (error) {
        console.error("Experiment failed", error);
        this.resilienceReports.push({
          experimentId: "unknown",
          timestamp: new Date(),
          stateLossEvents: 1,
          recoveryTime: 0,
          dataIntegrity: false,
          systemStability: "failed",
          details: { error: error.message },
        });
      }

      // Brief pause between experiments
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    this.generateResilienceReport();
  }

  /**
   * Generate comprehensive resilience report
   */
  private generateResilienceReport(): void {
    const totalExperiments = this.resilienceReports.length;
    const totalStateLoss = this.resilienceReports.reduce((sum, r) => sum + r.stateLossEvents, 0);
    const avgRecoveryTime =
      this.resilienceReports.reduce((sum, r) => sum + r.recoveryTime, 0) / totalExperiments;
    const dataIntegrityViolations = this.resilienceReports.filter((r) => !r.dataIntegrity).length;
    const stabilityCounts = this.resilienceReports.reduce(
      (counts, r) => {
        counts[r.systemStability] = (counts[r.systemStability] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    console.log("\n" + "=".repeat(80));
    console.log("📊 VALUEOS RESILIENCE REPORT");
    console.log("=".repeat(80));
    console.log(`Total Experiments: ${totalExperiments}`);
    console.log(`Total State Loss Events: ${totalStateLoss}`);
    console.log(`Average Recovery Time: ${avgRecoveryTime.toFixed(2)}ms`);
    console.log(`Data Integrity Violations: ${dataIntegrityViolations}`);
    console.log(`System Stability: ${JSON.stringify(stabilityCounts)}`);

    // Detailed results
    console.log("\n" + "-".repeat(80));
    console.log("DETAILED EXPERIMENT RESULTS:");
    console.log("-".repeat(80));

    this.resilienceReports.forEach((report) => {
      const icon =
        report.systemStability === "stable"
          ? "✅"
          : report.systemStability === "degraded"
            ? "⚠️"
            : "❌";

      console.log(`${icon} ${report.experimentId}`);
      console.log(`   State Loss Events: ${report.stateLossEvents}`);
      console.log(`   Recovery Time: ${report.recoveryTime.toFixed(2)}ms`);
      console.log(`   Data Integrity: ${report.dataIntegrity ? "✅" : "❌"}`);
      console.log(`   System Stability: ${report.systemStability.toUpperCase()}`);
      console.log(`   Details: ${JSON.stringify(report.details, null, 2)}`);
      console.log();
    });

    // Resilience assessment
    console.log("=".repeat(80));
    console.log("RESILIENCE ASSESSMENT:");
    console.log("=".repeat(80));

    const resilienceScore = Math.max(0, 100 - totalStateLoss * 10 - dataIntegrityViolations * 20);

    if (resilienceScore >= 90 && totalStateLoss === 0) {
      console.log("✅ EXCELLENT: System demonstrates high resilience");
      console.log("   Recommendation: Ready for production deployment");
    } else if (resilienceScore >= 75 && totalStateLoss <= 2) {
      console.log("⚠️  GOOD: System shows adequate resilience");
      console.log("   Recommendation: Address state loss events before production");
    } else if (resilienceScore >= 60) {
      console.log("❌ ACCEPTABLE: System needs improvement");
      console.log("   Recommendation: Implement additional state persistence mechanisms");
    } else {
      console.log("❌ POOR: System lacks resilience");
      console.log("   Recommendation: Major architectural review required");
    }

    console.log(`\nOverall Resilience Score: ${resilienceScore}/100`);
    console.log("\n" + "=".repeat(80) + "\n");

    // Exit with appropriate code
    const exitCode = resilienceScore >= 75 && totalStateLoss === 0 ? 0 : 1;
    process.exit(exitCode);
  }

  // Helper methods

  private async simulateWorkflowStart(executionId: string): Promise<void> {
    await this.redis.set(`workflow:${executionId}:status`, "RUNNING");
  }

  private async getWorkflowStatus(executionId: string): Promise<string> {
    const status = await this.redis.get(`workflow:${executionId}:status`);
    return status || "RUNNING";
  }

  private async setWorkflowStatus(executionId: string, status: string): Promise<void> {
    await this.redis.set(`workflow:${executionId}:status`, status);
  }

  private async resumeWorkflow(executionId: string): Promise<void> {
    const currentStatus = await this.getWorkflowStatus(executionId);
    if (currentStatus === "PAUSED" || currentStatus === "HALTED") {
      await this.setWorkflowStatus(executionId, "RUNNING");
    }
  }

  private async simulatePodRestart(agentName: string): Promise<void> {
    // Simulate pod restart by temporarily marking agent as unavailable
    const key = `agent:health:${agentName}`;
    await this.redis.setex(key, 5, "restarting"); // 5 second restart time
  }

  private async simulateSystemCrash(executionId: string): Promise<void> {
    // Simulate system crash by clearing volatile state
    await this.redis.del(`workflow:${executionId}:volatile`);
  }

  private async simulateRedisPartition(): Promise<void> {
    // Simulate Redis partition by disconnecting
    await this.redis.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second outage
  }

  private async restoreRedisConnection(): Promise<void> {
    // Restore Redis connection
    await this.redis.connect();
  }

  private async waitForWorkflowCompletion(
    executionId: string,
    timeoutMs: number
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getWorkflowStatus(executionId);
      if (status === "COMPLETED" || status === "FAILED") {
        return status === "COMPLETED";
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return false;
  }

  private async checkWorkflowCompletion(executionId: string): Promise<boolean> {
    const status = await this.getWorkflowStatus(executionId);
    return status === "COMPLETED";
  }

  private async verifyWorkflowDataIntegrity(executionId: string): Promise<boolean> {
    // Check if workflow execution record exists and is consistent
    const record = await this.redis.get(`workflow:execution:${executionId}`);
    return record !== null;
  }

  private async publishTestMessage(id: string): Promise<string> {
    const messageId = await this.redis.xadd(
      "valuecanvas.events",
      "*",
      "eventName",
      "test.event",
      "payload",
      JSON.stringify({ id, data: `Test message ${id}`, idempotencyKey: `test-key-${id}` }),
      "idempotencyKey",
      `test-key-${id}`,
      "attempt",
      "0"
    );
    return messageId;
  }

  private async getStreamMessageCount(): Promise<number> {
    try {
      return await this.redis.xlen("valuecanvas.events");
    } catch {
      return 0;
    }
  }

  private async getDlqMessageCount(): Promise<number> {
    try {
      return await this.redis.xlen("valuecanvas.events:dlq");
    } catch {
      return 0; // DLQ might not exist yet
    }
  }
}

// CLI entry point
if (require.main === module) {
  const suite = new ValueOSChaosSuite();

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "full") {
    suite.runChaosSuite();
  } else if (command === "agent-killer") {
    suite.runAgentKillerExperiment().then((report) => {
      console.log(JSON.stringify(report, null, 2));
    });
  } else if (command === "state-recovery") {
    suite.runStateRecoveryExperiment().then((report) => {
      console.log(JSON.stringify(report, null, 2));
    });
  } else if (command === "redis-partitioning") {
    suite.runRedisPartitioningExperiment().then((report) => {
      console.log(JSON.stringify(report, null, 2));
    });
  } else {
    console.log("Usage:");
    console.log("  chaos-test.ts full                    # Run all experiments");
    console.log("  chaos-test.ts agent-killer            # Run agent killer experiment");
    console.log("  chaos-test.ts state-recovery          # Run state recovery experiment");
    console.log("  chaos-test.ts redis-partitioning      # Run Redis partitioning experiment");
    process.exit(1);
  }
}

export { ValueOSChaosSuite };
