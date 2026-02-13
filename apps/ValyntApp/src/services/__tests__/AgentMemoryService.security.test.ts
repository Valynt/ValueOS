import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentMemoryService } from "../AgentMemoryService";

const testRecords = [
  {
    id: "memory-tenant-a",
    case_id: "case-1",
    tenant_id: "tenant-a",
    agent_type: "sales-agent",
    memory_type: "context",
    content: {
      title: "Tenant A Memory",
      description: "A scoped memory",
      data: {},
      tags: [],
      confidence: 0.9,
      source: "test",
      relevanceScore: 0.8,
    },
    metadata: {
      version: 1,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      size: 1,
      encrypted: false,
      complianceTags: [],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: null,
  },
  {
    id: "memory-tenant-b",
    case_id: "case-1",
    tenant_id: "tenant-b",
    agent_type: "sales-agent",
    memory_type: "context",
    content: {
      title: "Tenant B Memory",
      description: "Should never leak",
      data: {},
      tags: [],
      confidence: 0.9,
      source: "test",
      relevanceScore: 0.8,
    },
    metadata: {
      version: 1,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      size: 1,
      encrypted: false,
      complianceTags: [],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: null,
  },
];

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: vi.fn(),
  })),
}));

class MockQueryBuilder {
  private filters: Array<{ field: string; value: string }> = [];
  private readonly records: typeof testRecords;

  constructor(records: typeof testRecords) {
    this.records = records;
  }

  eq(field: string, value: string) {
    this.filters.push({ field, value });
    return this;
  }

  gte() {
    return this;
  }

  lte() {
    return this;
  }

  or() {
    return this;
  }

  order() {
    return this;
  }

  range() {
    return this;
  }

  then(resolve: (value: { data: typeof testRecords; error: null; count: number }) => void) {
    const filtered = this.records.filter((record) =>
      this.filters.every((filter) => {
        if (filter.field === "tenant_id") {
          return record.tenant_id === filter.value;
        }
        if (filter.field === "case_id") {
          return record.case_id === filter.value;
        }
        return true;
      })
    );

    resolve({
      data: filtered,
      error: null,
      count: filtered.length,
    });
  }
}

describe("AgentMemoryService tenant-scoped retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockImplementation(() => ({
      select: () => new MockQueryBuilder(testRecords),
    }));
  });

  it("rejects strict-mode queries when tenant scope is missing", async () => {
    const service = new AgentMemoryService("http://localhost:54321", "test-key");

    await expect(
      service.queryMemoriesStrict(
        {
          caseId: "case-1",
          agentType: "sales-agent",
        },
        "integrity-validation"
      )
    ).rejects.toThrow("Tenant-scoped memory query is required for integrity-validation");
  });

  it("returns only tenant-scoped records for strict queries", async () => {
    const service = new AgentMemoryService("http://localhost:54321", "test-key");

    const result = await service.queryMemoriesStrict(
      {
        caseId: "case-1",
        tenantId: "tenant-a",
        agentType: "sales-agent",
      },
      "integrity-validation"
    );

    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].tenantId).toBe("tenant-a");
    expect(result.memories.some((memory) => memory.tenantId === "tenant-b")).toBe(false);
  });
});
