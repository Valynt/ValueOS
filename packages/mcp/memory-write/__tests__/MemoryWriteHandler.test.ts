import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MemoryWriteHandler,
  MemoryWriteRequestSchema,
  MEMORY_WRITE_TOOLS,
} from "../index.js";
import type { MemoryWriteStore } from "../index.js";

function createMockStore(): MemoryWriteStore {
  return {
    hasIdempotencyKey: vi.fn().mockResolvedValue(false),
    recordIdempotencyKey: vi.fn().mockResolvedValue(undefined),
    writeSemanticFact: vi.fn().mockResolvedValue("fact-001"),
    writeEpisodicRecord: vi.fn().mockResolvedValue("episode-001"),
    writeEntityGraphEdge: vi.fn().mockResolvedValue("edge-001"),
    emitAudit: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MemoryWriteHandler", () => {
  let store: MemoryWriteStore;
  let handler: MemoryWriteHandler;

  beforeEach(() => {
    store = createMockStore();
    handler = new MemoryWriteHandler(store);
  });

  it("writes a semantic fact successfully", async () => {
    const result = await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "salesforce",
      sourceId: "sf-opp-001",
      target: "semantic",
      operation: "create",
      idempotencyKey: "sf-opp-001-fact-1",
      payload: {
        content: "Customer reported 20% cost reduction",
        factType: "value_proposition",
        confidenceScore: 0.85,
        evidenceTier: 2,
      },
    });

    expect(result.success).toBe(true);
    expect(result.recordId).toBe("fact-001");
    expect(result.target).toBe("semantic");
    expect(store.writeSemanticFact).toHaveBeenCalledOnce();
    expect(store.emitAudit).toHaveBeenCalledOnce();
  });

  it("writes an episodic record successfully", async () => {
    const result = await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "gong",
      sourceId: "gong-call-123",
      target: "episodic",
      operation: "create",
      idempotencyKey: "gong-call-123-ep-1",
      payload: {
        eventContent: "Discovery call with CFO discussed ROI concerns",
        importanceScore: 0.9,
      },
    });

    expect(result.success).toBe(true);
    expect(result.recordId).toBe("episode-001");
    expect(store.writeEpisodicRecord).toHaveBeenCalledOnce();
  });

  it("writes an entity graph edge successfully", async () => {
    const result = await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "agent",
      sourceId: "agent-discovery-1",
      target: "entity_graph",
      operation: "create",
      idempotencyKey: "agent-edge-1",
      payload: {
        valueCaseId: "00000000-0000-0000-0000-000000000002",
        sourceEntity: { id: "00000000-0000-0000-0000-000000000003", type: "account" },
        targetEntity: { id: "00000000-0000-0000-0000-000000000004", type: "kpi" },
        edgeType: "drives",
        weight: 1.5,
      },
    });

    expect(result.success).toBe(true);
    expect(result.recordId).toBe("edge-001");
    expect(store.writeEntityGraphEdge).toHaveBeenCalledOnce();
  });

  it("returns no-op for duplicate idempotency key", async () => {
    (store.hasIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "salesforce",
      sourceId: "sf-opp-001",
      target: "semantic",
      operation: "create",
      idempotencyKey: "sf-opp-001-fact-1",
      payload: { content: "duplicate" },
    });

    expect(result.success).toBe(true);
    expect(result.warnings).toContain(
      "Idempotency key already processed; no-op"
    );
    expect(store.writeSemanticFact).not.toHaveBeenCalled();
  });

  it("rejects invalid request", async () => {
    const result = await handler.handleWrite({
      // Missing required fields
      source: "salesforce",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation failed");
  });

  it("handles store errors gracefully", async () => {
    (store.writeSemanticFact as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection failed")
    );

    const result = await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "salesforce",
      sourceId: "sf-opp-001",
      target: "semantic",
      operation: "create",
      idempotencyKey: "sf-opp-001-fact-err",
      payload: { content: "test" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB connection failed");
  });

  it("reserves idempotency key before writing to close the TOCTOU race", async () => {
    // Regression: previously recordIdempotencyKey was called AFTER routeWrite,
    // so two concurrent requests with the same key could both pass the
    // hasIdempotencyKey check and produce duplicate writes.
    //
    // After the fix, recordIdempotencyKey is called BEFORE routeWrite.
    // We verify the call order by tracking the sequence of store method calls.
    const callOrder: string[] = [];

    (store.recordIdempotencyKey as ReturnType<typeof vi.fn>).mockImplementation(
      async () => { callOrder.push("recordIdempotencyKey"); }
    );
    (store.writeSemanticFact as ReturnType<typeof vi.fn>).mockImplementation(
      async () => { callOrder.push("writeSemanticFact"); return "fact-001"; }
    );

    await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "salesforce",
      sourceId: "sf-opp-001",
      target: "semantic",
      operation: "create",
      idempotencyKey: "race-test-key",
      payload: { content: "race condition test" },
    });

    // First call reserves the key (placeholder), second call updates it with
    // the real recordId. Both must come after hasIdempotencyKey but the first
    // reservation must precede the actual write.
    expect(callOrder[0]).toBe("recordIdempotencyKey"); // reservation
    expect(callOrder[1]).toBe("writeSemanticFact");    // write
    expect(callOrder[2]).toBe("recordIdempotencyKey"); // update with real recordId
  });

  it("second concurrent request sees key as reserved and returns no-op", async () => {
    // Simulate the second request arriving after the first has reserved the key
    // but before it has finished writing. hasIdempotencyKey returns true because
    // the reservation already exists.
    (store.hasIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await handler.handleWrite({
      tenantId: "tenant-1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      source: "salesforce",
      sourceId: "sf-opp-001",
      target: "semantic",
      operation: "create",
      idempotencyKey: "race-test-key",
      payload: { content: "duplicate" },
    });

    expect(result.success).toBe(true);
    expect(result.warnings).toContain("Idempotency key already processed; no-op");
    expect(store.writeSemanticFact).not.toHaveBeenCalled();
  });

  describe("executeTool", () => {
    it("executes memory_write_fact tool", async () => {
      const result = await handler.executeTool("memory_write_fact", {
        tenant_id: "tenant-1",
        organization_id: "00000000-0000-0000-0000-000000000001",
        source: "salesforce",
        source_id: "sf-001",
        content: "Test fact",
        fact_type: "opportunity",
        idempotency_key: "tool-fact-1",
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it("executes memory_write_episode tool", async () => {
      const result = await handler.executeTool("memory_write_episode", {
        tenant_id: "tenant-1",
        organization_id: "00000000-0000-0000-0000-000000000001",
        source: "gong",
        source_id: "gong-001",
        event_content: "Call with prospect",
        idempotency_key: "tool-ep-1",
      });

      expect(result.isError).toBeFalsy();
    });

    it("returns error for unknown tool", async () => {
      const result = await handler.executeTool("unknown_tool", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });
  });

  describe("Zod schema validation", () => {
    it("validates a complete write request", () => {
      const result = MemoryWriteRequestSchema.safeParse({
        tenantId: "tenant-1",
        organizationId: "00000000-0000-0000-0000-000000000001",
        source: "salesforce",
        sourceId: "sf-001",
        target: "semantic",
        operation: "create",
        idempotencyKey: "key-1",
        payload: { content: "test" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown source", () => {
      const result = MemoryWriteRequestSchema.safeParse({
        tenantId: "tenant-1",
        organizationId: "00000000-0000-0000-0000-000000000001",
        source: "unknown_source",
        sourceId: "id-1",
        target: "semantic",
        operation: "create",
        idempotencyKey: "key-1",
        payload: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe("tool definitions", () => {
    it("exports three MCP tools", () => {
      expect(MEMORY_WRITE_TOOLS).toHaveLength(3);
      const names = MEMORY_WRITE_TOOLS.map((t) => t.function.name);
      expect(names).toContain("memory_write_fact");
      expect(names).toContain("memory_write_episode");
      expect(names).toContain("memory_write_entity_edge");
    });
  });
});
