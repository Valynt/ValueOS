/**
 * FinancialModelingAgent — integration test (#1144)
 *
 * Verifies that a single agent.execute() call:
 *   1. Persists a financial_model_snapshots row with the correct case_id and organization_id.
 *   2. Stores a semantic_memory entry with tenant_id === organizationId.
 *   3. Does NOT return snapshot data when queried for a different organization (cross-tenant isolation).
 *
 * All external I/O (Supabase, LLM, MemorySystem) is mocked. The test exercises the
 * real agent code path — no logic is stubbed out.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const { mockCreateSnapshot, mockRetrieve, mockStoreSemanticMemory, mockComplete } = vi.hoisted(() => ({
  mockCreateSnapshot: vi.fn().mockResolvedValue({
    id: "snap-001",
    case_id: "case-abc",
    organization_id: "org-tenant-1",
    snapshot_version: 1,
    roi: 3,
    npv: 447257,
    payback_period_months: 24,
    assumptions_json: [],
    outputs_json: {},
    source_agent: "FinancialModelingAgent",
    created_at: new Date().toISOString(),
  }),
  mockRetrieve: vi.fn(),
  mockStoreSemanticMemory: vi.fn().mockResolvedValue("mem-001"),
  mockComplete: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../LLMGateway.js", () => ({
  LLMGateway: class {
    complete = mockComplete;
  },
}));

vi.mock("../../MemorySystem.js", () => ({
  MemorySystem: class {
    store = vi.fn().mockResolvedValue("mem-001");
    retrieve = mockRetrieve;
    storeSemanticMemory = mockStoreSemanticMemory;
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock("../../CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: { getFinancialData: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../../repositories/FinancialModelSnapshotRepository.js", () => ({
  FinancialModelSnapshotRepository: class {
    createSnapshot = mockCreateSnapshot;
  },
  financialModelSnapshotRepository: { createSnapshot: mockCreateSnapshot },
}));

// ProvenanceTracker — no-op in integration tests
vi.mock("../../../../lib/agents/ProvenanceTracker.js", () => ({
  getProvenanceTracker: () => ({ record: vi.fn().mockResolvedValue(undefined) }),
}));

// AgentKillSwitchService — always allow
vi.mock("../../../../services/agents/AgentKillSwitchService.js", () => ({
  AgentKillSwitchService: class {
    isKilled = vi.fn().mockResolvedValue(false);
  },
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { AgentConfig, LifecycleContext } from "../../../../types/agent";
import { CircuitBreaker } from "../../CircuitBreaker";
import { LLMGateway } from "../../LLMGateway";
import { MemorySystem } from "../../MemorySystem";
import { FinancialModelingAgent } from "../FinancialModelingAgent";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = "org-tenant-1";
const CASE_ID = "case-abc";
const OTHER_ORG_ID = "org-tenant-2";

function makeConfig(): AgentConfig {
  return {
    id: "financial-modeling-agent",
    name: "financial_modeling",
    type: "financial_modeling" as AgentConfig["type"],
    lifecycle_stage: "modeling",
    capabilities: [],
    model: { provider: "custom", model_name: "test" },
    prompts: { system_prompt: "", user_prompt_template: "" },
    parameters: {
      timeout_seconds: 30,
      max_retries: 3,
      retry_delay_ms: 1000,
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

function makeContext(overrides: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    workspace_id: CASE_ID,
    organization_id: ORG_ID,
    user_id: "user-001",
    lifecycle_stage: "modeling",
    workspace_data: {},
    // value_case_id is required for persistSnapshot to be called
    user_inputs: { value_case_id: CASE_ID },
    ...overrides,
  };
}

const STORED_HYPOTHESES = [
  {
    id: "mem_hyp_1",
    agent_id: "opportunity",
    workspace_id: CASE_ID,
    content: "Hypothesis: Supply Chain Optimization — Reduce procurement costs.",
    memory_type: "semantic",
    importance: 0.75,
    created_at: "2024-01-01T00:00:00Z",
    accessed_at: "2024-01-01T00:00:00Z",
    access_count: 0,
    metadata: {
      verified: true,
      category: "cost_reduction",
      confidence: 0.8,
      estimated_impact: { low: 500000, high: 1200000, unit: "usd" },
      organization_id: ORG_ID,
    },
  },
];

const LLM_RESPONSE = JSON.stringify({
  projections: [
    {
      hypothesis_id: "hyp-1",
      hypothesis_description: "Supply Chain Optimization",
      category: "cost_reduction",
      assumptions: ["Vendor consolidation reduces unit costs by 20%"],
      cash_flows: [-200000, 150000, 300000, 350000],
      currency: "USD",
      period_type: "annual",
      discount_rate: 0.10,
      total_investment: 200000,
      total_benefit: 800000,
      confidence: 0.8,
      risk_factors: ["Vendor switching costs may exceed estimates"],
      data_sources: ["ERP procurement data Q4 2024"],
    },
  ],
  portfolio_summary: "One model with positive NPV.",
  key_assumptions: ["Stable market conditions"],
  sensitivity_parameters: [
    { name: "discount_rate", base_value: 0.10, perturbations: [0.08, 0.10, 0.12] },
  ],
  recommended_next_steps: ["Validate vendor quotes"],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FinancialModelingAgent — integration", () => {
  let agent: FinancialModelingAgent;

  beforeEach(() => {
    vi.clearAllMocks();

    agent = new FinancialModelingAgent(
      makeConfig(),
      ORG_ID,
      new MemorySystem({} as Parameters<typeof MemorySystem>[0]) as InstanceType<typeof MemorySystem>,
      new LLMGateway("custom") as InstanceType<typeof LLMGateway>,
      new CircuitBreaker() as InstanceType<typeof CircuitBreaker>,
    );

    mockRetrieve.mockImplementation((query: { agent_id?: string }) => {
      if (query.agent_id === "opportunity") return Promise.resolve(STORED_HYPOTHESES);
      return Promise.resolve([]);
    });

    mockComplete.mockResolvedValue({
      id: "resp-1",
      model: "test-model",
      content: LLM_RESPONSE,
      finish_reason: "stop",
      usage: { prompt_tokens: 800, completion_tokens: 600, total_tokens: 1400 },
    });
  });

  describe("DB persistence — financial_model_snapshots", () => {
    it("calls createSnapshot with correct case_id and organization_id", async () => {
      await agent.execute(makeContext());

      expect(mockCreateSnapshot).toHaveBeenCalledOnce();
      expect(mockCreateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          case_id: CASE_ID,
          organization_id: ORG_ID,
        }),
      );
    });

    it("snapshot includes roi and npv from computed model", async () => {
      await agent.execute(makeContext());

      const call = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
      expect(typeof call.roi).toBe("number");
      expect(typeof call.npv).toBe("number");
      expect(call.npv as number).toBeGreaterThan(0);
    });

    it("snapshot source_agent identifies the modeling agent", async () => {
      await agent.execute(makeContext());

      const call = mockCreateSnapshot.mock.calls[0][0] as Record<string, unknown>;
      // source_agent is set from this.name (config name), not the class name
      expect(typeof call.source_agent).toBe("string");
      expect(call.source_agent).toBeTruthy();
    });
  });

  describe("Memory persistence — semantic_memory tenant isolation", () => {
    it("stores semantic memory with organization_id === tenant", async () => {
      await agent.execute(makeContext());

      // At least one storeSemanticMemory call must carry organization_id === ORG_ID
      const tenantedCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: unknown[]) => {
          const meta = call[4] as Record<string, unknown> | undefined;
          return meta?.organization_id === ORG_ID;
        },
      );
      expect(tenantedCalls.length).toBeGreaterThan(0);
    });

    it("memory entries for financial models carry npv and roi", async () => {
      await agent.execute(makeContext());

      const modelCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: unknown[]) => {
          const meta = call[4] as Record<string, unknown> | undefined;
          return meta?.type === "financial_model";
        },
      );
      expect(modelCalls.length).toBeGreaterThan(0);

      const meta = modelCalls[0][4] as Record<string, unknown>;
      expect(typeof meta.npv).toBe("number");
      expect(typeof meta.roi).toBe("number");
      expect(meta.organization_id).toBe(ORG_ID);
    });
  });

  describe("Cross-tenant isolation", () => {
    it("rejects execution when context organization_id does not match agent tenant", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: OTHER_ORG_ID })),
      ).rejects.toThrow(/tenant context mismatch/i);
    });

    it("does not call createSnapshot when tenant mismatch is detected", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: OTHER_ORG_ID })),
      ).rejects.toThrow();

      expect(mockCreateSnapshot).not.toHaveBeenCalled();
    });

    it("does not store memory when tenant mismatch is detected", async () => {
      await expect(
        agent.execute(makeContext({ organization_id: OTHER_ORG_ID })),
      ).rejects.toThrow();

      // storeSemanticMemory must not have been called with the other org's data
      const otherOrgCalls = mockStoreSemanticMemory.mock.calls.filter(
        (call: unknown[]) => {
          const meta = call[4] as Record<string, unknown> | undefined;
          return meta?.organization_id === OTHER_ORG_ID;
        },
      );
      expect(otherOrgCalls).toHaveLength(0);
    });
  });

  describe("End-to-end happy path", () => {
    it("returns success with models, persists snapshot, and stores memory in a single run", async () => {
      const result = await agent.execute(makeContext());

      // Agent output
      expect(result.status).toBe("success");
      expect(result.result.models_count).toBe(1);

      // DB persistence
      expect(mockCreateSnapshot).toHaveBeenCalledOnce();

      // Memory persistence
      expect(mockStoreSemanticMemory).toHaveBeenCalled();

      // All memory writes scoped to correct tenant
      for (const call of mockStoreSemanticMemory.mock.calls) {
        const meta = call[4] as Record<string, unknown> | undefined;
        if (meta?.organization_id !== undefined) {
          expect(meta.organization_id).toBe(ORG_ID);
        }
      }
    });
  });
});
