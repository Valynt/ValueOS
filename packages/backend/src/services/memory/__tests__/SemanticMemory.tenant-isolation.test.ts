import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/lib/supabase.js", () => ({
  createServerSupabaseClient: () => ({
    rpc: rpcMock,
  }),
}));

import { SemanticMemoryService } from "@shared/lib/SemanticMemory.js";

describe("SemanticMemoryService tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    } as Response);
  });

  it("fails fast when search is called without tenant scope", async () => {
    const memory = new SemanticMemoryService();

    await expect(memory.search("query without tenant")).rejects.toThrow(
      "SemanticMemory.search requires organizationId (or tenantId) for tenant isolation"
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("passes tenant scope to search_semantic_memory RPC", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const memory = new SemanticMemoryService();
    await memory.search("tenant scoped query", {
      tenantId: "tenant-123",
      limit: 5,
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "search_semantic_memory",
      expect.objectContaining({
        p_organization_id: "tenant-123",
        match_count: 5,
      })
    );
  });
});
