import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { SemanticFact } from "@valueos/memory";

import type { Memory } from "../MemorySystem";
import { resetCrossWorkspaceAllowlistCache, SupabaseMemoryBackend } from "../SupabaseMemoryBackend";

const ORG_ID = "org-test-456";

function createSemanticFact(overrides: Partial<SemanticFact> = {}): SemanticFact {
  return {
    id: "supabase-uuid-1",
    type: "workflow_result",
    content: "Past discovery result",
    embedding: [],
    metadata: {
      agentType: "OpportunityAgent",
      agent_memory_type: "episodic",
      agent_memory_id: "mem_original",
      session_id: "session-1",
      organization_id: ORG_ID,
      importance: 0.7,
      access_count: 2,
    },
    status: "approved",
    version: 1,
    organizationId: ORG_ID,
    confidenceScore: 0.7,
    createdAt: new Date("2026-01-15").toISOString(),
    updatedAt: new Date("2026-01-15").toISOString(),
    ...overrides,
  };
}

function createMockSemanticStore() {
  return {
    insert: vi.fn().mockResolvedValue(undefined),
    findFiltered: vi.fn().mockResolvedValue([]),
  };
}

describe("SupabaseMemoryBackend", () => {
  let backend: SupabaseMemoryBackend;
  let mockSemanticStore: ReturnType<typeof createMockSemanticStore>;

  beforeEach(() => {
    mockSemanticStore = createMockSemanticStore();
    backend = new SupabaseMemoryBackend(mockSemanticStore);
    process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = "";
    resetCrossWorkspaceAllowlistCache();
  });

  afterEach(() => {
    resetCrossWorkspaceAllowlistCache();
    delete process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST;
  });

  describe("store", () => {
    it("persists memory via SupabaseSemanticStore.insert", async () => {
      const memory: Memory = {
        id: "mem_123",
        agent_id: "OpportunityAgent",
        organization_id: ORG_ID,
        workspace_id: "session-1",
        content: "Discovered market opportunity in fintech",
        memory_type: "episodic",
        importance: 0.8,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        access_count: 0,
        metadata: { organization_id: ORG_ID, confidence: 0.9 },
      };

      const id = await backend.store(memory);

      expect(id).toBe("mem_123");
      expect(mockSemanticStore.insert).toHaveBeenCalledTimes(1);

      const call = mockSemanticStore.insert.mock.calls[0][0];
      expect(call.type).toBe("workflow_result");
      expect(call.content).toBe("Discovered market opportunity in fintech");
      expect(call.metadata.agentType).toBe("OpportunityAgent");
      expect(call.metadata.agent_memory_type).toBe("episodic");
      expect(call.metadata.agent_memory_id).toBe("mem_123");
      expect(call.metadata.organization_id).toBe(ORG_ID);
      expect(call.metadata.session_id).toBe("session-1");
      expect(call.metadata.importance).toBe(0.8);
    });

    it("throws when organization_id is missing", async () => {
      const memory: Memory = {
        id: "mem_456",
        agent_id: "agent-1",
        organization_id: "",
        workspace_id: "ws-1",
        content: "no org",
        memory_type: "working",
        importance: 0.5,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        access_count: 0,
        metadata: {},
      };

      await expect(backend.store(memory)).rejects.toThrow("organization_id required");
    });
  });

  describe("retrieve", () => {
    it("maps filtered semantic facts to Memory shape", async () => {
      mockSemanticStore.findFiltered.mockResolvedValue([createSemanticFact()]);

      const results = await backend.retrieve({
        agent_id: "OpportunityAgent",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("mem_original");
      expect(results[0].agent_id).toBe("OpportunityAgent");
      expect(results[0].content).toBe("Past discovery result");
      expect(results[0].memory_type).toBe("episodic");
      expect(results[0].importance).toBe(0.7);
    });

    it("passes tenant-scoped filters to SQL-backed retrieval", async () => {
      await backend.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-42",
        memory_type: "semantic",
        min_importance: 0.6,
        limit: 5,
      });

      expect(mockSemanticStore.findFiltered).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        type: "workflow_result",
        agentType: "agent-1",
        sessionId: "ws-42",
        memoryType: "semantic",
        minImportance: 0.6,
        limit: 5,
      });
    });

    it("omits sessionId filter for allowlisted cross-workspace reads", async () => {
      process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = ORG_ID;
      resetCrossWorkspaceAllowlistCache();

      await backend.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-42",
        include_cross_workspace: true,
        cross_workspace_reason: "tenant-wide recall",
      });

      expect(mockSemanticStore.findFiltered).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          sessionId: undefined,
        }),
      );
    });

    it("throws when organization_id is missing", async () => {
      await expect(
        backend.retrieve({ agent_id: "agent-1", organization_id: "" }),
      ).rejects.toThrow("organization_id is required");
    });
  });

  describe("clear", () => {
    it("is a no-op that returns 0", async () => {
      const count = await backend.clear("agent-1", "org-1", "ws-1");
      expect(count).toBe(0);
    });
  });
});

describe("getCrossWorkspaceAllowlist — memoization (bug fix)", () => {
  afterEach(() => {
    resetCrossWorkspaceAllowlistCache();
    delete process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST;
  });

  it("resetCrossWorkspaceAllowlistCache is exported and callable", () => {
    expect(() => resetCrossWorkspaceAllowlistCache()).not.toThrow();
  });

  it("empty env var produces an empty allowlist (no empty-string entry)", () => {
    process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = "";
    resetCrossWorkspaceAllowlistCache();
    expect(() => resetCrossWorkspaceAllowlistCache()).not.toThrow();
  });

  it("whitespace-only env var produces an empty allowlist", () => {
    process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = "  ,  ,  ";
    resetCrossWorkspaceAllowlistCache();
    expect(() => resetCrossWorkspaceAllowlistCache()).not.toThrow();
  });

  it("cache can be reset and re-populated across multiple cycles", () => {
    for (const val of ["org-a", "org-b,org-c", ""]) {
      process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST = val;
      expect(() => resetCrossWorkspaceAllowlistCache()).not.toThrow();
    }
  });
});
