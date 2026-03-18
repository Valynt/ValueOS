/**
 * TenantContextIngestionService unit tests
 *
 * Uses the real service class with a mock MemorySystem and a mock Supabase
 * client (for clearPriorContext). No live DB or network required.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase — vi.mock is hoisted, so the factory must not reference
// variables declared outside it (TDZ). Build the mock entirely inside.
// ---------------------------------------------------------------------------

vi.mock("../../lib/supabase.js", () => {
  const mockDelete = vi.fn().mockResolvedValue({ error: null });
  const mockContains = vi.fn().mockReturnValue(mockDelete);
  const mockEq = vi.fn().mockReturnValue({ contains: mockContains });
  const mockDeleteChain = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ delete: mockDeleteChain });

  return {
    createServerSupabaseClient: () => ({ from: mockFrom }),
    getSupabaseClient: () => ({ from: mockFrom }),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { MemorySystem } from "../../lib/agent-fabric/MemorySystem.js";

import { TenantContextIngestionService } from "./TenantContextIngestionService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMemoryMock(): MemorySystem {
  return {
    storeSemanticMemory: vi.fn().mockResolvedValue("memory-id"),
  } as unknown as MemorySystem;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TenantContextIngestionService", () => {
  const orgId = "org-abc-123";
  let memory: MemorySystem;
  let svc: TenantContextIngestionService;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = makeMemoryMock();
    svc = new TenantContextIngestionService(memory);
  });

  it("stores one entry per context section (4 total with all fields)", async () => {
    const result = await svc.ingest(orgId, {
      websiteUrl: "https://acme.com",
      productDescription: "Enterprise value management",
      icpDefinition: "VP Sales at mid-market B2B SaaS",
      competitorList: ["Mediafly", "Gainsight"],
    });

    expect(result.stored).toBe(true);
    expect(result.memoryEntries).toBe(4);
    expect(memory.storeSemanticMemory).toHaveBeenCalledTimes(4);
  });

  it("always passes organizationId as the last argument to storeSemanticMemory", async () => {
    await svc.ingest(orgId, {
      productDescription: "desc",
      icpDefinition: "icp",
      competitorList: [],
    });

    const calls = vi.mocked(memory.storeSemanticMemory).mock.calls;
    for (const call of calls) {
      expect(call[5]).toBe(orgId);
    }
  });

  it("omits websiteUrl entry when not provided", async () => {
    const result = await svc.ingest(orgId, {
      productDescription: "desc",
      icpDefinition: "icp",
      competitorList: [],
    });

    expect(result.memoryEntries).toBe(2);
  });

  it("omits competitorList entry when list is empty", async () => {
    const result = await svc.ingest(orgId, {
      websiteUrl: "https://acme.com",
      productDescription: "desc",
      icpDefinition: "icp",
      competitorList: [],
    });

    expect(result.memoryEntries).toBe(3);
  });

  it("continues storing remaining entries when one fails (partial resilience)", async () => {
    vi.mocked(memory.storeSemanticMemory)
      .mockResolvedValueOnce("id-1")
      .mockRejectedValueOnce(new Error("storage failure"))
      .mockResolvedValueOnce("id-3")
      .mockResolvedValueOnce("id-4");

    const result = await svc.ingest(orgId, {
      websiteUrl: "https://acme.com",
      productDescription: "desc",
      icpDefinition: "icp",
      competitorList: ["Rival"],
    });

    expect(result.stored).toBe(true);
    expect(result.memoryEntries).toBe(3);
  });

  it("returns stored: true even when all entries fail", async () => {
    vi.mocked(memory.storeSemanticMemory).mockRejectedValue(new Error("all fail"));

    const result = await svc.ingest(orgId, {
      productDescription: "desc",
      icpDefinition: "icp",
      competitorList: [],
    });

    expect(result.stored).toBe(true);
    expect(result.memoryEntries).toBe(0);
  });
});
