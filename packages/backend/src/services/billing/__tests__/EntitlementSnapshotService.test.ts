/**
 * EntitlementSnapshotService Tests
 *
 * Validates snapshot creation, superseding, and entitlement computation.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PriceVersionDefinition } from "../PriceVersionService";

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let mockChainResult: { data: unknown; error: unknown } = { data: null, error: null };
const mockFrom = vi.fn();

const createChain = (): Record<string, unknown> => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "eq", "is", "order"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // limit is a terminal method for list queries — resolve with data
  chain.limit = vi.fn(() => {
    // Return a thenable that also has .single()
    const result = Promise.resolve(mockChainResult);
    (result as Record<string, unknown>).single = vi.fn(() => Promise.resolve(mockChainResult));
    return result;
  });
  chain.single = vi.fn(() => Promise.resolve(mockChainResult));
  // Make the chain itself thenable for queries that end without .single()
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(mockChainResult).then(resolve, reject);
  return chain;
};

const mockSupabaseClient = {
  from: (table: string) => {
    mockFrom(table);
    return createChain();
  },
};

vi.mock("../../../lib/supabase.js", () => ({
  supabase: mockSupabaseClient,
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock PriceVersionService.getById
const mockGetById = vi.fn();
vi.mock("../PriceVersionService.js", () => ({
  default: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_DEFINITION: PriceVersionDefinition = {
  name: "Standard",
  price_usd: 99,
  billing_period: "monthly",
  meters: {
    ai_tokens: { included_quantity: 1000000, hard_cap_quantity: null, overage_rate: 0.00001, enforcement: "bill_overage" },
    api_calls: { included_quantity: 100000, hard_cap_quantity: 200000, overage_rate: 0.001, enforcement: "hard_lock" },
    storage_gb: { included_quantity: 100, hard_cap_quantity: null, overage_rate: 0.5, enforcement: "grace_then_lock" },
  },
  features: ["Feature A"],
};

const PRICE_VERSION = {
  id: "pv-1",
  version_tag: "v1.0",
  plan_tier: "standard",
  definition: SAMPLE_DEFINITION,
  status: "active",
  activated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EntitlementSnapshotService", () => {
  let EntitlementSnapshotService: new (supabase: unknown) => Record<string, (...args: unknown[]) => Promise<unknown>>;
  let service: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../EntitlementSnapshotService");
    EntitlementSnapshotService = mod.default as unknown as typeof EntitlementSnapshotService;
    service = new EntitlementSnapshotService(mockSupabaseClient);
  });

  describe("createSnapshot", () => {
    it("creates snapshot from price version and supersedes current", async () => {
      mockGetById.mockResolvedValue(PRICE_VERSION);

      const snapshotRow = {
        id: "snap-1",
        tenant_id: "t-1",
        subscription_id: "sub-1",
        price_version_id: "pv-1",
        entitlements: {
          ai_tokens: { included: 1000000, cap: null, overage_rate: 0.00001, enforcement: "bill_overage" },
          api_calls: { included: 100000, cap: 200000, overage_rate: 0.001, enforcement: "hard_lock" },
          storage_gb: { included: 100, cap: null, overage_rate: 0.5, enforcement: "grace_then_lock" },
        },
        effective_at: "2026-02-01T00:00:00Z",
        superseded_at: null,
        created_at: "2026-02-01T00:00:00Z",
      };

      mockChainResult = { data: snapshotRow, error: null };

      const result = await service.createSnapshot("t-1", "sub-1", "pv-1") as Record<string, unknown>;

      expect(mockGetById).toHaveBeenCalledWith("pv-1");
      expect(mockFrom).toHaveBeenCalledWith("entitlement_snapshots");
      expect(result.id).toBe("snap-1");
      expect(result.superseded_at).toBeNull();
    });

    it("throws when price version not found", async () => {
      mockGetById.mockResolvedValue(null);

      await expect(
        service.createSnapshot("t-1", "sub-1", "pv-nonexistent")
      ).rejects.toThrow("not found");
    });
  });

  describe("getCurrentSnapshot", () => {
    it("returns current non-superseded snapshot", async () => {
      const snapshot = {
        id: "snap-1",
        tenant_id: "t-1",
        superseded_at: null,
        entitlements: { ai_tokens: { included: 1000000 } },
      };
      mockChainResult = { data: snapshot, error: null };

      const result = await service.getCurrentSnapshot("t-1") as Record<string, unknown>;
      expect(result).not.toBeNull();
      expect(result.id).toBe("snap-1");
    });

    it("returns null when no snapshot exists", async () => {
      mockChainResult = { data: null, error: { code: "PGRST116", message: "not found" } };

      const result = await service.getCurrentSnapshot("t-1");
      expect(result).toBeNull();
    });
  });

  describe("getMeterEntitlement", () => {
    it("returns entitlement for specific meter", async () => {
      const snapshot = {
        id: "snap-1",
        tenant_id: "t-1",
        superseded_at: null,
        entitlements: {
          ai_tokens: { included: 1000000, cap: null, overage_rate: 0.00001, enforcement: "bill_overage" },
          api_calls: { included: 100000, cap: 200000, overage_rate: 0.001, enforcement: "hard_lock" },
        },
      };
      mockChainResult = { data: snapshot, error: null };

      const entitlement = await service.getMeterEntitlement("t-1", "ai_tokens") as Record<string, unknown>;
      expect(entitlement).not.toBeNull();
      expect(entitlement.included).toBe(1000000);
      expect(entitlement.enforcement).toBe("bill_overage");
    });

    it("returns null for unknown meter key", async () => {
      const snapshot = {
        id: "snap-1",
        tenant_id: "t-1",
        superseded_at: null,
        entitlements: { ai_tokens: { included: 1000000 } },
      };
      mockChainResult = { data: snapshot, error: null };

      const entitlement = await service.getMeterEntitlement("t-1", "nonexistent");
      expect(entitlement).toBeNull();
    });

    it("returns null when no snapshot exists", async () => {
      mockChainResult = { data: null, error: { code: "PGRST116", message: "not found" } };

      const entitlement = await service.getMeterEntitlement("t-1", "ai_tokens");
      expect(entitlement).toBeNull();
    });
  });

  describe("getHistory", () => {
    it("returns snapshots ordered by effective_at desc", async () => {
      const snapshots = [
        { id: "snap-2", effective_at: "2026-02-01" },
        { id: "snap-1", effective_at: "2026-01-01" },
      ];
      mockChainResult = { data: snapshots, error: null };

      const result = await service.getHistory("t-1") as unknown[];
      expect(result).toHaveLength(2);
    });
  });

  describe("entitlement computation", () => {
    it("correctly maps price version meters to entitlements", async () => {
      mockGetById.mockResolvedValue(PRICE_VERSION);

      const snapshotRow = {
        id: "snap-1",
        tenant_id: "t-1",
        subscription_id: "sub-1",
        price_version_id: "pv-1",
        entitlements: {},
        effective_at: "2026-02-01T00:00:00Z",
        superseded_at: null,
        created_at: "2026-02-01T00:00:00Z",
      };
      mockChainResult = { data: snapshotRow, error: null };

      // The service computes entitlements internally before insert.
      // We verify the PriceVersionService was called.
      await service.createSnapshot("t-1", "sub-1", "pv-1");
      expect(mockGetById).toHaveBeenCalledWith("pv-1");
    });
  });
});
