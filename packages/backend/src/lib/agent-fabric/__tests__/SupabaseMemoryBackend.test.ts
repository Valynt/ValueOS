import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { Memory } from "../MemorySystem";
import { SupabaseMemoryBackend } from "../SupabaseMemoryBackend";

const ORG_ID = "org-test-456";

function createMockSemanticMemory() {
  return {
    store: vi.fn().mockResolvedValue("supabase-uuid-1"),
    search: vi.fn().mockResolvedValue([]),
    storeChunk: vi.fn(),
    chunkText: vi.fn(),
    storeValueProposition: vi.fn(),
    getSimilarValuePropositions: vi.fn(),
    storeTargetDefinition: vi.fn(),
    getSimilarTargets: vi.fn(),
    storeIntegrityCheck: vi.fn(),
    getCommonIntegrityIssues: vi.fn(),
    storeWorkflowResult: vi.fn(),
    getSimilarWorkflows: vi.fn(),
    pruneMemories: vi.fn(),
    getStatistics: vi.fn(),
  };
}

describe("SupabaseMemoryBackend", () => {
  let backend: SupabaseMemoryBackend;
  let mockSemantic: ReturnType<typeof createMockSemanticMemory>;

  beforeEach(() => {
    mockSemantic = createMockSemanticMemory();
    backend = new SupabaseMemoryBackend(mockSemantic as any);
  });

  describe("store", () => {
    it("persists memory via SemanticMemoryService.store", async () => {
      const memory: Memory = {
        id: "mem_123",
        agent_id: "OpportunityAgent",
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

      expect(id).toBe("supabase-uuid-1");
      expect(mockSemantic.store).toHaveBeenCalledTimes(1);

      const call = mockSemantic.store.mock.calls[0][0];
      expect(call.type).toBe("workflow_result");
      expect(call.content).toBe("Discovered market opportunity in fintech");
      expect(call.metadata.agentType).toBe("OpportunityAgent");
      expect(call.metadata.agent_memory_type).toBe("episodic");
      expect(call.metadata.agent_memory_id).toBe("mem_123");
      expect(call.metadata.organization_id).toBe(ORG_ID);
      expect(call.metadata.session_id).toBe("session-1");
      expect(call.metadata.importance).toBe(0.8);
    });

    it("throws when organization_id is missing from metadata", async () => {
      const memory: Memory = {
        id: "mem_456",
        agent_id: "agent-1",
        workspace_id: "ws-1",
        content: "no org",
        memory_type: "working",
        importance: 0.5,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        access_count: 0,
        metadata: {},
      };

      await expect(backend.store(memory)).rejects.toThrow(
        "organization_id required"
      );
    });
  });

  describe("retrieve", () => {
    it("maps SemanticMemoryService search results to Memory shape", async () => {
      mockSemantic.search.mockResolvedValue([
        {
          entry: {
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
            createdAt: new Date("2026-01-15"),
          },
          similarity: 0.85,
        },
      ]);

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
      expect(results[0].metadata?.similarity).toBe(0.85);
    });

    it("filters by agent_id from metadata", async () => {
      mockSemantic.search.mockResolvedValue([
        {
          entry: {
            id: "uuid-1",
            type: "workflow_result",
            content: "wrong agent",
            embedding: [],
            metadata: {
              agentType: "TargetAgent",
              agent_memory_type: "episodic",
              organization_id: ORG_ID,
            },
            createdAt: new Date(),
          },
          similarity: 0.9,
        },
      ]);

      const results = await backend.retrieve({
        agent_id: "OpportunityAgent",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(0);
    });

    it("filters by memory_type when specified", async () => {
      mockSemantic.search.mockResolvedValue([
        {
          entry: {
            id: "uuid-1",
            type: "workflow_result",
            content: "semantic memory",
            embedding: [],
            metadata: {
              agentType: "agent-1",
              agent_memory_type: "semantic",
              organization_id: ORG_ID,
              importance: 0.5,
            },
            createdAt: new Date(),
          },
          similarity: 0.8,
        },
      ]);

      const results = await backend.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        memory_type: "episodic",
      });

      expect(results).toHaveLength(0);
    });

    it("passes organization_id and workspace_id to search", async () => {
      await backend.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-42",
        limit: 5,
      });

      expect(mockSemantic.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          organizationId: ORG_ID,
          sessionId: "ws-42",
          limit: 5,
        }),
      );
    });

    it("throws when organization_id is missing", async () => {
      await expect(
        backend.retrieve({ agent_id: "agent-1", organization_id: "" })
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
