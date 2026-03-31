/**
 * Test Agent for BaseAgent testing
 */

import { BaseAgent } from "../BaseAgent";
import type { AgentConfig, AgentOutput, LifecycleContext } from "../../../types/agent";

export class TestAgent extends BaseAgent {
  private mockResult: any = {};
  private mockMetadata: any = {};

  constructor(config: AgentConfig) {
    super(config);
    this.name = "TestAgent";
    this.lifecycleStage = "test";
    this.version = "1.0.0";
    // Ensure organizationId is set for tenant verification
    this.organizationId = config.organizationId;
  }

  mockExecute(result: any, metadata: any = {}): void {
    this.mockResult = result;
    this.mockMetadata = metadata;
  }

  async _execute(context: LifecycleContext): Promise<AgentOutput> {
    return this.buildOutput(
      this.mockResult,
      "success",
      "high",
      Date.now(),
      this.mockMetadata
    );
  }
}
