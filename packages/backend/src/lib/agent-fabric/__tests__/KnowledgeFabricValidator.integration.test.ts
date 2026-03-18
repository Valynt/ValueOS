/**
 * KnowledgeFabricValidator — integration tests
 *
 * Exercises the full detection path:
 *   secureInvoke → BaseAgent.validateWithKnowledgeFabric()
 *               → KnowledgeFabricValidator.validate()
 *               → memory cross-reference + GroundTruth benchmark check
 *
 * Uses real KnowledgeFabricValidator and MemorySystem instances.
 * LLMGateway and CircuitBreaker are mocked at module level to avoid
 * deep dependency chains (CostAwareRouter, telemetry, etc.).
 *
 * Issue: #1147
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Module-level mocks — must precede all imports
// ---------------------------------------------------------------------------

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mockComplete } = vi.hoisted(() => ({ mockComplete: vi.fn() }));

vi.mock("../LLMGateway.js", () => ({
  LLMGateway: class MockLLMGateway {
    constructor() {}
    complete = mockComplete;
  },
}));

vi.mock("../CircuitBreaker.js", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    constructor() {}
    execute = vi.fn().mockImplementation((fn: () => unknown) => fn());
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { AgentConfig } from "../../../types/agent.js";
import { BaseAgent } from "../agents/BaseAgent.js";
import type { AgentOutput, LifecycleContext } from "../agents/BaseAgent.js";
import { CircuitBreaker } from "../CircuitBreaker.js";
import { KnowledgeFabricValidator } from "../KnowledgeFabricValidator.js";
import { LLMGateway } from "../LLMGateway.js";
import { MemorySystem } from "../MemorySystem.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "integ-kfv-org-aaaa-0000-0000-000000000001";
const OTHER_ORG = "integ-kfv-org-bbbb-0000-0000-000000000002";
const SESSION_ID = "integ-kfv-session-1";

// ---------------------------------------------------------------------------
// Minimal AgentConfig
// ---------------------------------------------------------------------------

function makeConfig(): AgentConfig {
  return {
    id: "test-agent",
    name: "TestAgent",
    type: "opportunity" as never,
    lifecycle_stage: "opportunity",
    capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: {
      timeout_seconds: 30,
      max_retries: 1,
      retry_delay_ms: 0,
      enable_caching: false,
      enable_telemetry: false,
    },
    constraints: {
      max_input_tokens: 4096,
      max_output_tokens: 4096,
      allowed_actions: [],
      forbidden_actions: [],
      required_permissions: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal concrete agent — exposes secureInvoke publicly
// ---------------------------------------------------------------------------

class TestAgent extends BaseAgent {
  public readonly lifecycleStage = "opportunity" as const;

  async execute(_context: LifecycleContext): Promise<AgentOutput> {
    return this.prepareOutput({}, "completed");
  }

  async invokePublic<T>(sessionId: string, prompt: string, schema: z.ZodSchema<T>) {
    return this.secureInvoke(sessionId, prompt, schema, { trackPrediction: false });
  }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeMemorySystem(): MemorySystem {
  return new MemorySystem({ max_memories: 100, enable_persistence: false });
}

function makeAgent(ms: MemorySystem): TestAgent {
  return new TestAgent(
    makeConfig(),
    ORG_ID,
    ms,
    new LLMGateway({ provider: "together", model: "test" }),
    new CircuitBreaker(),
  );
}

function makeGroundTruth(valid: boolean, warning?: string) {
  return {
    validateClaim: vi.fn().mockResolvedValue({
      valid,
      percentile: valid ? "p50" : "p95",
      warning: warning ?? (valid ? undefined : "Value exceeds benchmark range"),
      citation: "ESO Benchmark Database 2025",
    }),
  };
}

async function seedMemory(ms: MemorySystem, agentId: string, content: string, orgId = ORG_ID) {
  await ms.storeSemanticMemory(
    SESSION_ID,
    agentId,
    "semantic",
    content,
    { organization_id: orgId },
    orgId,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("KnowledgeFabricValidator (integration)", () => {
  let memorySystem: MemorySystem;

  beforeEach(() => {
    vi.clearAllMocks();
    memorySystem = makeMemorySystem();
  });

  // -------------------------------------------------------------------------
  // 1. Numeric contradiction detection
  // -------------------------------------------------------------------------

  describe("numeric contradiction detection", () => {
    it("detects hallucination when LLM claims a value >30% different from seeded memory", async () => {
      await seedMemory(
        memorySystem,
        "TestAgent",
        "The current baseline: 45.5 has been validated by the integrity team.",
      );

      const validator = new KnowledgeFabricValidator(memorySystem, null, {
        contradictionThreshold: 0.75,
        contradictionFailThreshold: 1,
      });

      // 12.0 is ~74% divergence from 45.5 — well above the 30% threshold
      const result = await validator.validate(
        "Analysis shows baseline: 12.0 which indicates significant improvement.",
        ORG_ID,
        "TestAgent",
      );

      expect(result.passed).toBe(false);
      expect(result.contradictions).toHaveLength(1);
      expect(result.contradictions[0]?.claim).toContain("baseline");
      expect(result.contradictions[0]?.claim).toContain("12");
      expect(result.contradictions[0]?.existingFact).toContain("45.5");
      expect(result.method).toBe("knowledge_fabric");
    });

    it("passes when LLM value is within 30% of seeded memory", async () => {
      await seedMemory(
        memorySystem,
        "TestAgent",
        "The current baseline: 45.5 has been validated.",
      );

      const validator = new KnowledgeFabricValidator(memorySystem, null, {
        contradictionFailThreshold: 1,
      });

      // 47.0 is ~3.3% from 45.5 — within tolerance
      const result = await validator.validate(
        "Analysis shows baseline: 47.0 which is consistent with prior data.",
        ORG_ID,
        "TestAgent",
      );

      expect(result.passed).toBe(true);
      expect(result.contradictions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Negation contradiction detection
  // -------------------------------------------------------------------------

  describe("negation contradiction detection", () => {
    it("detects hallucination when LLM negates a previously validated claim", async () => {
      await seedMemory(
        memorySystem,
        "TestAgent",
        "The proposed KPI target is achievable based on historical data.",
      );

      const validator = new KnowledgeFabricValidator(memorySystem, null, {
        contradictionFailThreshold: 1,
      });

      const result = await validator.validate(
        "The proposed KPI target is not achievable given current constraints.",
        ORG_ID,
        "TestAgent",
      );

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // 3. GroundTruth benchmark misalignment
  // -------------------------------------------------------------------------

  describe("GroundTruth benchmark misalignment", () => {
    it("detects BenchmarkMisalignment when claimed metric fails GroundTruth check", async () => {
      const groundTruth = makeGroundTruth(false, "Value exceeds p95 benchmark");

      const validator = new KnowledgeFabricValidator(
        memorySystem,
        groundTruth as never,
        { enableBenchmarkCheck: true, contradictionFailThreshold: 1 },
      );

      // ESO-KPI pattern triggers benchmark check
      const result = await validator.validate(
        "The ESO-KPI-cost_reduction_rate: 99.9 has been achieved this quarter.",
        ORG_ID,
        "TestAgent",
      );

      expect(result.benchmarkMisalignments).toHaveLength(1);
      expect(result.benchmarkMisalignments[0]?.validation.valid).toBe(false);
      expect(result.passed).toBe(false);
      expect(groundTruth.validateClaim).toHaveBeenCalledWith(
        expect.stringContaining("ESO-KPI"),
        expect.any(Number),
      );
    });

    it("passes when GroundTruth validates the claimed metric", async () => {
      const groundTruth = makeGroundTruth(true);

      const validator = new KnowledgeFabricValidator(
        memorySystem,
        groundTruth as never,
        { enableBenchmarkCheck: true, contradictionFailThreshold: 1 },
      );

      const result = await validator.validate(
        "The ESO-KPI-cost_reduction_rate: 15.0 is within expected range.",
        ORG_ID,
        "TestAgent",
      );

      expect(result.benchmarkMisalignments).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Full secureInvoke path — hallucination_check propagates
  // -------------------------------------------------------------------------

  describe("secureInvoke integration", () => {
    const ResponseSchema = z.object({
      analysis: z.string(),
      baseline: z.number(),
      hallucination_check: z.boolean().optional(),
    });

    it("propagates hallucination_check: false through secureInvoke when contradiction detected", async () => {
      await seedMemory(
        memorySystem,
        "TestAgent",
        "The current baseline: 45.5 is the validated baseline.",
      );

      const validator = new KnowledgeFabricValidator(memorySystem, null, {
        contradictionFailThreshold: 1,
      });

      // LLM returns a contradicting value (12.0 vs seeded 45.5)
      mockComplete.mockResolvedValue({
        content: JSON.stringify({
          analysis: "Market analysis shows baseline: 12.0 which is the current rate",
          baseline: 12.0,
          hallucination_check: true, // LLM self-reports true; KF should override
        }),
        model: "test",
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      });

      const agent = makeAgent(memorySystem);
      agent.setKnowledgeFabricValidator(validator);

      const result = await agent.invokePublic(SESSION_ID, "Analyze the market", ResponseSchema);

      expect(result.hallucination_details?.knowledgeFabric?.passed).toBe(false);
      expect(result.hallucination_details?.passed).toBe(false);
      expect(result.hallucination_details?.requiresEscalation).toBe(true);
    });

    it("propagates hallucination_check: true when no contradictions found", async () => {
      // No seeded memories — nothing to contradict
      const validator = new KnowledgeFabricValidator(memorySystem, null, {
        contradictionFailThreshold: 1,
      });

      mockComplete.mockResolvedValue({
        content: JSON.stringify({
          analysis: "Market analysis shows baseline: 12.0 which is the current rate",
          baseline: 45.5,
          hallucination_check: true,
        }),
        model: "test",
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      });

      const agent = makeAgent(memorySystem);
      agent.setKnowledgeFabricValidator(validator);

      const result = await agent.invokePublic(SESSION_ID, "Analyze the market", ResponseSchema);

      expect(result.hallucination_details?.knowledgeFabric?.passed).toBe(true);
      expect(result.hallucination_details?.knowledgeFabric?.contradictions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Tenant isolation — cross-org memories do not trigger contradictions
  // -------------------------------------------------------------------------

  describe("tenant isolation", () => {
    it("does not detect contradiction from a different organization's memory", async () => {
      // Seed conflicting fact under OTHER_ORG
      await seedMemory(
        memorySystem,
        "TestAgent",
        "The current baseline: 45.5 has been validated.",
        OTHER_ORG,
      );

      const validator = new KnowledgeFabricValidator(memorySystem, null, {
        contradictionFailThreshold: 1,
      });

      // Validate under ORG_ID — must not see OTHER_ORG's memory
      const result = await validator.validate(
        "Analysis shows baseline: 12.0 which is the correct value.",
        ORG_ID,
        "TestAgent",
      );

      expect(result.contradictions).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });
});
