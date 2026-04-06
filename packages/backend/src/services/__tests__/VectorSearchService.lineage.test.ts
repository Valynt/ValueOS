import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  counterAdd,
  histogramRecord,
  redisGet,
  redisSetex,
  rpcMock,
} = vi.hoisted(() => ({
  counterAdd: vi.fn(),
  histogramRecord: vi.fn(),
  redisGet: vi.fn(),
  redisSetex: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

vi.mock("@shared/lib/redisClient", () => ({
  getRedisClient: vi.fn(() => ({
    get: redisGet,
    setex: redisSetex,
    scan: vi.fn(),
    del: vi.fn(),
  })),
}));

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn(() => ({ add: counterAdd })),
      createHistogram: vi.fn(() => ({ record: histogramRecord })),
    })),
  },
}));

import { VectorSearchService } from "../memory/VectorSearchService.js";

describe("VectorSearchService lineage enforcement", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "production";
    process.env.REDIS_URL = "redis://cache.internal:6379";
    redisGet.mockResolvedValue(null);
    redisSetex.mockResolvedValue("OK");
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "mem-1",
          type: "opportunity",
          content: "Revenue optimization",
          embedding: [0.1, 0.2],
          metadata: {
            workflowId: "wf-123",
            source_origin: "sec",
            data_sensitivity_level: "tier_1",
          },
          created_at: "2026-03-21T00:00:00.000Z",
          similarity: 0.91,
        },
      ],
      error: null,
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.REDIS_URL = originalRedisUrl;
  });

  it("passes lineage requirements and tenant scope as typed RPC parameters", async () => {
    const service = new VectorSearchService();

    await service.searchByEmbedding([0.1, 0.2], {
      type: "opportunity",
      filters: {
        organization_id: "org-123",
        workflowId: "wf-123",
      },
      tenantId: "tenant-123",
      callerService: "GroundTruthService",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "search_semantic_memory_filtered",
      expect.objectContaining({
        p_metadata_filters: {
          workflowId: "wf-123",
        },
        p_organization_id: "org-123",
        p_require_lineage: true,
        p_tenant_id: "tenant-123",
        p_type: "opportunity",
      })
    );
    expect(redisSetex).toHaveBeenCalledOnce();
    expect(counterAdd).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        cache_outcome: "miss",
        caller_service: "GroundTruthService",
      })
    );
  });

  it("records cache-hit metrics and skips the RPC on a Redis hit", async () => {
    const service = new VectorSearchService();
    redisGet.mockResolvedValue(
      JSON.stringify([
        {
          memory: {
            id: "mem-2",
            type: "opportunity",
            content: "Cached memory",
            embedding: [0.5, 0.6],
            metadata: {
              source_origin: "sec",
              data_sensitivity_level: "tier_1",
            },
            created_at: "2026-03-21T00:00:00.000Z",
          },
          similarity: 0.93,
          lineage: {
            source_origin: "sec",
            data_sensitivity_level: "tier_1",
          },
          evidenceLog: "Source: sec (sensitivity: tier_1)",
        },
      ])
    );

    const results = await service.searchByEmbedding([0.3, 0.4], {
      callerService: "GroundTruthService",
      tenantId: "tenant-123",
    });

    expect(results).toHaveLength(1);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(counterAdd).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        cache_outcome: "hit",
        caller_service: "GroundTruthService",
      })
    );
    expect(histogramRecord).toHaveBeenCalled();
  });
});
