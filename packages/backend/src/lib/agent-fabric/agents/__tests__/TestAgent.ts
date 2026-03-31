/**
 * TestAgent — minimal concrete BaseAgent for unit tests.
 *
 * Constructs BaseAgent with vi-mocked dependencies so tests run without
 * infrastructure (no Supabase, no LLM, no Redis).
 */

import { vi } from "vitest";

import { CircuitBreaker } from "../../../lib/resilience/CircuitBreaker.js";
import type { AgentOutput, LifecycleContext } from "../../../types/agent.js";
import { BaseAgent } from "../BaseAgent.js";

// Minimal AgentConfig that satisfies the type without requiring real values
const STUB_CONFIG = {
  id: "test-agent",
  name: "TestAgent",
  type: "opportunity" as const,
  lifecycle_stage: "test" as const,
  capabilities: [],
  model: { provider: "openai" as const, model: "gpt-4", temperature: 0, max_tokens: 1024 },
  prompts: { system: "", user: "" },
  parameters: { max_retries: 0, timeout_ms: 5000, confidence_threshold: 0.5 },
  constraints: { max_cost_per_call: 0, allowed_tools: [] },
};

// Stub MemorySystem — only the interface surface BaseAgent touches
const stubMemory = {
  store: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  retrieve: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
} as any;

// Stub LLMGateway — BaseAgent calls this only via secureInvoke, not in execute()
const stubLLM = {
  complete: vi.fn().mockResolvedValue({ content: "", usage: {} }),
} as any;

export interface TestAgentOptions {
  organizationId: string;
}

export class TestAgent extends BaseAgent {
  private mockResult: unknown = {};
  private mockMetadata: Record<string, unknown> = {};

  constructor({ organizationId }: TestAgentOptions) {
    super(
      { ...STUB_CONFIG, name: "TestAgent" },
      organizationId,
      stubMemory,
      stubLLM,
      new CircuitBreaker(),
    );
    // Override fields set by super() so test assertions match
    (this as any).name = "TestAgent";
    (this as any).lifecycleStage = "test";
    (this as any).version = "1.0.0";
  }

  mockExecute(result: unknown, metadata: Record<string, unknown> = {}): void {
    this.mockResult = result;
    this.mockMetadata = metadata;
  }

  async _execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.buildOutput(
      this.mockResult as Record<string, unknown>,
      "success",
      "high",
      Date.now(),
      this.mockMetadata,
    );
  }
}
