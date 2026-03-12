import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { MemoryPersistenceBackend } from "../MemoryPersistenceBackend";
import { MemorySystem } from "../MemorySystem";
import type { Memory, MemoryQuery } from "../MemorySystem";

function createMockBackend(): MemoryPersistenceBackend & {
  store: ReturnType<typeof vi.fn>;
  retrieve: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
} {
  return {
    store: vi.fn().mockResolvedValue("supabase-id-1"),
    retrieve: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue(0),
  };
}

const ORG_ID = "org-test-123";

describe("MemorySystem", () => {
  // ── In-memory only (no backend) ──────────────────────────────────

  describe("without backend (in-memory only)", () => {
    let ms: MemorySystem;

    beforeEach(() => {
      ms = new MemorySystem({ max_memories: 100, enable_persistence: false });
    });

    it("stores and retrieves memories from local cache", async () => {
      const id = await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "test memory",
        memory_type: "episodic",
        importance: 0.8,
        metadata: { organization_id: ORG_ID },
      });

      expect(id).toMatch(/^mem_/);

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("test memory");
    });

    it("enforces tenant isolation on retrieve", async () => {
      await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "tenant A memory",
        memory_type: "episodic",
        importance: 0.5,
        metadata: { organization_id: "org-A" },
      });

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: "org-B",
      });

      expect(results).toHaveLength(0);
    });

    it("throws when organization_id is missing from retrieve", async () => {
      await expect(
        ms.retrieve({ agent_id: "agent-1", organization_id: "" })
      ).rejects.toThrow("organization_id is required");
    });

    it("clears memories for an agent", async () => {
      await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "to be cleared",
        memory_type: "working",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      const count = await ms.clear("agent-1", ORG_ID);
      expect(count).toBe(1);

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });
      expect(results).toHaveLength(0);
    });
  });

  // ── Persistence backend ──────────────────────────────────────────

  describe("with persistence backend", () => {
    let ms: MemorySystem;
    let backend: ReturnType<typeof createMockBackend>;

    beforeEach(() => {
      backend = createMockBackend();
      ms = new MemorySystem(
        { max_memories: 100, enable_persistence: true },
        backend,
      );
    });

    it("delegates store to backend", async () => {
      await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "persisted memory",
        memory_type: "semantic",
        importance: 0.9,
        metadata: { organization_id: ORG_ID },
      });

      expect(backend.store).toHaveBeenCalledTimes(1);
      const storedMemory = backend.store.mock.calls[0][0] as Memory;
      expect(storedMemory.content).toBe("persisted memory");
      expect(storedMemory.agent_id).toBe("agent-1");
    });

    it("returns backend results on retrieve when available", async () => {
      const backendMemory: Memory = {
        id: "supabase-mem-1",
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "from supabase",
        memory_type: "episodic",
        importance: 0.7,
        created_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
        access_count: 3,
        metadata: { organization_id: ORG_ID },
      };
      backend.retrieve.mockResolvedValue([backendMemory]);

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("from supabase");
      expect(results[0].access_count).toBe(3);
    });

    it("falls back to local cache when backend retrieve fails", async () => {
      backend.retrieve.mockRejectedValue(new Error("Supabase down"));

      await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "cached memory",
        memory_type: "episodic",
        importance: 0.6,
        metadata: { organization_id: ORG_ID },
      });

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("cached memory");
    });

    it("falls back to local cache when backend returns empty", async () => {
      backend.retrieve.mockResolvedValue([]);

      await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "local only",
        memory_type: "working",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("local only");
    });

    it("continues storing locally when backend store fails", async () => {
      backend.store.mockRejectedValue(new Error("Supabase down"));

      const id = await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "still cached",
        memory_type: "episodic",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      expect(id).toMatch(/^mem_/);

      backend.retrieve.mockResolvedValue([]);

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("still cached");
    });

    it("delegates clear to backend", async () => {
      await ms.clear("agent-1", ORG_ID, "ws-1");
      expect(backend.clear).toHaveBeenCalledWith("agent-1", ORG_ID, "ws-1");
    });
  });

  // ── setBackend ───────────────────────────────────────────────────

  describe("setBackend", () => {
    it("allows attaching a backend after construction", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: true });
      const backend = createMockBackend();

      ms.setBackend(backend);

      await ms.store({
        agent_id: "agent-1",
        organization_id: ORG_ID,
        workspace_id: "ws-1",
        content: "late-bound backend",
        memory_type: "procedural",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      expect(backend.store).toHaveBeenCalledTimes(1);
    });
  });

  // ── storeSemanticMemory ──────────────────────────────────────────

  describe("storeSemanticMemory", () => {
    it("delegates to store with correct field mapping", async () => {
      const backend = createMockBackend();
      const ms = new MemorySystem(
        { max_memories: 100, enable_persistence: true },
        backend,
      );

      await ms.storeSemanticMemory(
        "session-1",
        "OpportunityAgent",
        "episodic",
        "LLM Response: ...",
        { confidence: 0.8, hallucination_check: true },
        ORG_ID,
      );

      expect(backend.store).toHaveBeenCalledTimes(1);
      const stored = backend.store.mock.calls[0][0] as Memory;
      expect(stored.agent_id).toBe("OpportunityAgent");
      expect(stored.workspace_id).toBe("session-1");
      expect(stored.memory_type).toBe("episodic");
      expect(stored.metadata?.organization_id).toBe(ORG_ID);
    });

    it("redacts PII in memory content and metadata", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: false });

      await ms.storeSemanticMemory(
        "session-1",
        "OpportunityAgent",
        "episodic",
        "Email john@example.com phone 415-555-1212 account_id ACCT998877",
        { contact: "john@example.com", account: "account_id ACCT998877" },
        ORG_ID,
      );

      const results = await ms.retrieve({
        agent_id: "OpportunityAgent",
        organization_id: ORG_ID,
        memory_type: "episodic",
      });

      expect(results[0].content).toContain("[REDACTED_EMAIL]");
      expect(results[0].content).toContain("[REDACTED_PHONE]");
      expect(results[0].content).toContain("[REDACTED_ACCOUNT_ID]");
      expect(results[0].metadata?.contact).toBe("[REDACTED_EMAIL]");
      expect(String(results[0].metadata?.account)).toContain("[REDACTED_ACCOUNT_ID]");
    });

    it("uses protected summary for episodic/semantic content in high-trust mode", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: false, high_trust_mode: true });

      await ms.storeSemanticMemory(
        "session-1",
        "OpportunityAgent",
        "episodic",
        "Reach me at john@example.com for account_id ACCT123456",
        {},
        ORG_ID,
      );

      const results = await ms.retrieve({
        agent_id: "OpportunityAgent",
        organization_id: ORG_ID,
        memory_type: "episodic",
      });

      expect(results[0].content).toContain("[HIGH_TRUST_SUMMARY]");
      expect(results[0].content).toContain("[REDACTED_EMAIL]");
      expect(results[0].content).toMatch(/\[HASH:[a-f0-9]{64}\]/);
    });
  });

  // ── storeEpisodicMemory ──────────────────────────────────────────

  describe("storeEpisodicMemory", () => {
    it("stores episodic memory with correct type", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: false });

      await ms.storeEpisodicMemory(
        "session-1",
        "agent-a",
        "Processed query about pricing",
        { success: true },
        ORG_ID,
      );

      const results = await ms.retrieve({
        agent_id: "agent-a",
        organization_id: ORG_ID,
        memory_type: "episodic",
      });

      expect(results).toHaveLength(1);
      expect(results[0].memory_type).toBe("episodic");
    });
  });

  // ── Episodes ─────────────────────────────────────────────────────

  describe("episodes", () => {
    let ms: MemorySystem;

    beforeEach(() => {
      ms = new MemorySystem({ max_memories: 100, enable_persistence: false });
    });

    it("stores and retrieves episodes", async () => {
      const episodeId = await ms.storeEpisode({
        sessionId: "session-1",
        agentId: "opportunity",
        episodeType: "agent_invocation",
        taskIntent: "Analyze customer churn",
        context: { organizationId: ORG_ID },
        initialState: { query: "churn analysis" },
        finalState: { result: "5% churn rate" },
        success: true,
        rewardScore: 0.9,
        durationSeconds: 2.5,
      }, ORG_ID);

      expect(episodeId).toMatch(/^ep_/);

      const similar = await ms.retrieveSimilarEpisodes(
        { agent: "opportunity", query: "customer churn" },
        ORG_ID,
        5,
      );

      expect(similar).toHaveLength(1);
      expect(similar[0].task_intent).toBe("Analyze customer churn");
    });

    it("filters episodes by organization (tenant isolation)", async () => {
      await ms.storeEpisode({
        sessionId: "s1",
        agentId: "opportunity",
        episodeType: "test",
        taskIntent: "Analyze revenue",
        context: { organizationId: "org-a" },
        initialState: {},
        finalState: {},
        success: true,
        rewardScore: 0.8,
        durationSeconds: 1,
      }, "org-a");

      await ms.storeEpisode({
        sessionId: "s2",
        agentId: "opportunity",
        episodeType: "test",
        taskIntent: "Analyze revenue",
        context: { organizationId: "org-b" },
        initialState: {},
        finalState: {},
        success: true,
        rewardScore: 0.7,
        durationSeconds: 1,
      }, "org-b");

      const resultsA = await ms.retrieveSimilarEpisodes(
        { agent: "opportunity", query: "revenue" },
        "org-a",
        10,
      );

      expect(resultsA).toHaveLength(1);
      expect(resultsA[0].context.organizationId).toBe("org-a");
    });
  });

  // ── Consolidation ────────────────────────────────────────────────

  describe("consolidation", () => {
    it("promotes frequently-accessed episodic memories to semantic", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: false });

      await ms.storeEpisodicMemory("s1", "agent-a", "Memory 1", {}, ORG_ID);
      await ms.storeEpisodicMemory("s1", "agent-a", "Memory 2", {}, ORG_ID);

      // Simulate frequent access (3+ times)
      for (let i = 0; i < 4; i++) {
        await ms.retrieve({
          agent_id: "agent-a",
          organization_id: ORG_ID,
          memory_type: "episodic",
        });
      }

      const result = await ms.consolidate(ORG_ID);

      expect(result.episodicMerged).toBe(2);
      expect(result.semanticCreated).toBe(1);

      const semanticResults = await ms.retrieve({
        agent_id: "agent-a",
        organization_id: ORG_ID,
        memory_type: "semantic",
      });

      expect(semanticResults).toHaveLength(1);
      expect(semanticResults[0].content).toContain("[Consolidated]");
    });

    it("prunes expired working memory", async () => {
      const ms = new MemorySystem({
        max_memories: 100,
        ttl_seconds: 1,
        enable_persistence: false,
      });

      await ms.store({
        agent_id: "agent-a",
        organization_id: ORG_ID,
        workspace_id: "s1",
        content: "Working memory",
        memory_type: "working",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 1100));

      const result = await ms.consolidate(ORG_ID);
      expect(result.workingPruned).toBe(1);
    });
  });

  // ── Stats ────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("returns memory statistics", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: false });

      await ms.storeSemanticMemory("s1", "a1", "episodic", "test", {}, ORG_ID);
      await ms.storeEpisodicMemory("s1", "a1", "test2", {}, ORG_ID);
      await ms.storeEpisode({
        sessionId: "s1",
        agentId: "a1",
        episodeType: "test",
        taskIntent: "test",
        context: {},
        initialState: {},
        finalState: {},
        success: true,
        rewardScore: 0.5,
        durationSeconds: 1,
      }, ORG_ID);

      const stats = ms.getStats();
      expect(stats.totalMemories).toBe(2);
      expect(stats.totalEpisodes).toBe(1);
      expect(stats.byType.episodic).toBe(2);
    });
  });

  // ── Eviction ─────────────────────────────────────────────────────

  describe("eviction", () => {
    it("evicts least important memory when max is reached", async () => {
      const ms = new MemorySystem({ max_memories: 2, enable_persistence: false });

      await ms.store({
        agent_id: "a1",
        organization_id: ORG_ID,
        workspace_id: "s1",
        content: "Low importance",
        memory_type: "episodic",
        importance: 0.1,
        metadata: { organization_id: ORG_ID },
      });

      await ms.store({
        agent_id: "a1",
        organization_id: ORG_ID,
        workspace_id: "s1",
        content: "High importance",
        memory_type: "episodic",
        importance: 0.9,
        metadata: { organization_id: ORG_ID },
      });

      await ms.store({
        agent_id: "a1",
        organization_id: ORG_ID,
        workspace_id: "s1",
        content: "Medium importance",
        memory_type: "episodic",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      const stats = ms.getStats();
      expect(stats.totalMemories).toBe(2);

      const results = await ms.retrieve({
        agent_id: "a1",
        organization_id: ORG_ID,
      });

      const contents = results.map((r) => r.content);
      expect(contents).not.toContain("Low importance");
      expect(contents).toContain("High importance");
    });
  });
});

// ── BUG-1 regression: consolidate() must use top-level organization_id ────────
// Before the fix, consolidate() filtered on memory.metadata?.organization_id
// (the old location). After the B3 refactor moved organization_id to a
// top-level field, memories stored without metadata.organization_id were
// silently skipped — consolidation was a no-op for all tenants.

describe("MemorySystem.consolidate() tenant isolation (BUG-1 regression)", () => {
  const ORG_A = "org-a-111";
  const ORG_B = "org-b-222";

  it("consolidates memories stored with top-level organization_id (no metadata.organization_id)", async () => {
    const ms = new MemorySystem({ max_memories: 100, enable_persistence: false });

    // Store two episodic memories using the high-level helper which sets
    // organization_id at the top level only (no metadata.organization_id).
    await ms.storeEpisodicMemory("s1", "agent-x", "Memory A", {}, ORG_A);
    await ms.storeEpisodicMemory("s1", "agent-x", "Memory B", {}, ORG_A);

    // Simulate enough accesses to trigger consolidation (threshold is 3).
    for (let i = 0; i < 4; i++) {
      await ms.retrieve({ agent_id: "agent-x", organization_id: ORG_A, memory_type: "episodic" });
    }

    const result = await ms.consolidate(ORG_A);

    // Must consolidate — not a no-op.
    expect(result.episodicMerged).toBe(2);
    expect(result.semanticCreated).toBe(1);
  });

  it("does not consolidate memories belonging to a different tenant", async () => {
    const ms = new MemorySystem({ max_memories: 100, enable_persistence: false });

    // ORG_B memories — should NOT be touched when consolidating ORG_A.
    await ms.storeEpisodicMemory("s1", "agent-x", "Org B Memory 1", {}, ORG_B);
    await ms.storeEpisodicMemory("s1", "agent-x", "Org B Memory 2", {}, ORG_B);

    for (let i = 0; i < 4; i++) {
      await ms.retrieve({ agent_id: "agent-x", organization_id: ORG_B, memory_type: "episodic" });
    }

    // Consolidate ORG_A — ORG_B memories must be untouched.
    const result = await ms.consolidate(ORG_A);
    expect(result.episodicMerged).toBe(0);
    expect(result.semanticCreated).toBe(0);

    // ORG_B memories still present.
    const orgBMemories = await ms.retrieve({ agent_id: "agent-x", organization_id: ORG_B });
    expect(orgBMemories.length).toBeGreaterThanOrEqual(2);
  });
});
