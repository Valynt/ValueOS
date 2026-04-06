/**
 * Price Version Service Tests
 *
 * Tests immutability enforcement, activation/archival, and version pinning.
 * Uses mocked Supabase client.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PriceVersionDefinition } from "../PriceVersionService";

// Track mock calls
const mockFrom = vi.fn();
let mockChainResult: { data: unknown; error: unknown } = { data: null, error: null };

const createChain = (): Record<string, unknown> => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "eq", "is", "order", "limit"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(mockChainResult));
  return chain;
};

const mockSupabaseClient = {
  from: (table: string) => {
    mockFrom(table);
    return createChain();
  },
};

// Mock the supabase lib to avoid env/module resolution issues
vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: mockSupabaseClient,
  createServerSupabaseClient: () => mockSupabaseClient,
  getSupabaseClient: () => mockSupabaseClient,
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const SAMPLE_DEFINITION: PriceVersionDefinition = {
  name: "Test Plan",
  price_usd: 99,
  billing_period: "monthly",
  meters: {
    ai_tokens: {
      included_quantity: 1000000,
      hard_cap_quantity: null,
      overage_rate: 0.00001,
      enforcement: "bill_overage",
    },
    api_calls: {
      included_quantity: 100000,
      hard_cap_quantity: null,
      overage_rate: 0.001,
      enforcement: "bill_overage",
    },
  },
  features: ["Feature A"],
};

describe("PriceVersionService", () => {
  let PriceVersionService: { default: Record<string, (...args: unknown[]) => unknown> };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    PriceVersionService = await import("../PriceVersionService");
  });

  describe("immutability enforcement", () => {
    it("updateDraft rejects non-draft versions", async () => {
      mockChainResult = {
        data: { id: "v1", status: "active", version_tag: "v1.0", plan_tier: "standard", definition: SAMPLE_DEFINITION },
        error: null,
      };

      await expect(
        PriceVersionService.default.updateDraft("v1", SAMPLE_DEFINITION)
      ).rejects.toThrow("only 'draft' versions are mutable");
    });

    it("activate rejects non-draft versions", async () => {
      mockChainResult = {
        data: { id: "v1", status: "archived", version_tag: "v1.0", plan_tier: "standard", definition: SAMPLE_DEFINITION },
        error: null,
      };

      await expect(
        PriceVersionService.default.activate("v1")
      ).rejects.toThrow("must be 'draft'");
    });
  });

  describe("createDraft", () => {
    it("calls supabase insert with correct table", async () => {
      mockChainResult = {
        data: { id: "new-v", version_tag: "v2.0", plan_tier: "standard", status: "draft", definition: SAMPLE_DEFINITION },
        error: null,
      };

      const result = await PriceVersionService.default.createDraft("v2.0", "standard", SAMPLE_DEFINITION);
      expect(mockFrom).toHaveBeenCalledWith("billing_price_versions");
      expect((result as Record<string, unknown>).status).toBe("draft");
    });

    it("throws on duplicate version tag + plan tier", async () => {
      mockChainResult = {
        data: null,
        error: { code: "23505", message: "duplicate key" },
      };

      await expect(
        PriceVersionService.default.createDraft("v1.0", "standard", SAMPLE_DEFINITION)
      ).rejects.toThrow("already exists");
    });
  });

  describe("getActiveVersion", () => {
    it("returns active version for plan tier", async () => {
      const activeVersion = {
        id: "v-active",
        version_tag: "v1.0",
        plan_tier: "standard",
        status: "active",
        definition: SAMPLE_DEFINITION,
        activated_at: "2026-01-01T00:00:00Z",
      };
      mockChainResult = { data: activeVersion, error: null };

      const result = await PriceVersionService.default.getActiveVersion("standard");
      expect(mockFrom).toHaveBeenCalledWith("billing_price_versions");
      expect((result as Record<string, unknown>).status).toBe("active");
    });

    it("returns null when no active version exists", async () => {
      mockChainResult = { data: null, error: { code: "PGRST116", message: "not found" } };

      const result = await PriceVersionService.default.getActiveVersion("standard");
      expect(result).toBeNull();
    });
  });
});
