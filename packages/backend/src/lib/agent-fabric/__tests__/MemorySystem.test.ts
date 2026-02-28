import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { MemorySystem } from "../MemorySystem";
import type { MemoryPersistenceBackend } from "../MemoryPersistenceBackend";
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
  describe("without backend (in-memory only)", () => {
    let ms: MemorySystem;

    beforeEach(() => {
      ms = new MemorySystem({ max_memories: 100, enable_persistence: false });
    });

    it("stores and retrieves memories from local cache", async () => {
      const id = await ms.store({
        agent_id: "agent-1",
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
        workspace_id: "ws-1",
        content: "to be cleared",
        memory_type: "working",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      const count = await ms.clear("agent-1");
      expect(count).toBe(1);

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });
      expect(results).toHaveLength(0);
    });
  });

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

      // Store locally first
      await ms.store({
        agent_id: "agent-1",
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
        workspace_id: "ws-1",
        content: "still cached",
        memory_type: "episodic",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      expect(id).toMatch(/^mem_/);

      // Force local cache retrieval by making backend return empty
      backend.retrieve.mockResolvedValue([]);

      const results = await ms.retrieve({
        agent_id: "agent-1",
        organization_id: ORG_ID,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe("still cached");
    });

    it("delegates clear to backend", async () => {
      await ms.clear("agent-1", "ws-1");
      expect(backend.clear).toHaveBeenCalledWith("agent-1", "ws-1");
    });
  });

  describe("setBackend", () => {
    it("allows attaching a backend after construction", async () => {
      const ms = new MemorySystem({ max_memories: 100, enable_persistence: true });
      const backend = createMockBackend();

      ms.setBackend(backend);

      await ms.store({
        agent_id: "agent-1",
        workspace_id: "ws-1",
        content: "late-bound backend",
        memory_type: "procedural",
        importance: 0.5,
        metadata: { organization_id: ORG_ID },
      });

      expect(backend.store).toHaveBeenCalledTimes(1);
    });
  });

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
  });
});
