/**
 * Price Version Service Tests
 *
 * Tests immutability enforcement, activation/archival, and version pinning.
 * Uses mocked Supabase client.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PriceVersionDefinition } from "../PriceVersionService";

// Track mock calls
const mockFrom = vi.fn();
let mockChainResult: any = { data: null, error: null };

// Mock Supabase before any imports that use it
vi.stubEnv("VITE_SUPABASE_URL", "https://your-project.supabase.co");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");

vi.mock("@supabase/supabase-js", () => {
  const createChain = (): any => {
    const chain: any = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(mockChainResult)),
    };
    return chain;
  };

  return {
    createClient: vi.fn(() => ({
      from: (table: string) => {
        mockFrom(table);
        return createChain();
      },
    })),
  };
});

vi.mock("../../../lib/logger", () => ({
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
  let PriceVersionService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module cache to get fresh instance with mocked env
    vi.resetModules();
    const mod = await import("../PriceVersionService");
    PriceVersionService = mod.default;
  });

  describe("getMeterPricing", () => {
    it("returns meter pricing from definition", () => {
      const pricing = PriceVersionService.getMeterPricing(SAMPLE_DEFINITION, "ai_tokens");
      expect(pricing).toEqual({
        included_quantity: 1000000,
        hard_cap_quantity: null,
        overage_rate: 0.00001,
        enforcement: "bill_overage",
      });
    });

    it("returns null for unknown meter", () => {
      const pricing = PriceVersionService.getMeterPricing(SAMPLE_DEFINITION, "unknown_meter");
      expect(pricing).toBeNull();
    });
  });

  describe("immutability enforcement", () => {
    it("updateDraft rejects non-draft versions", async () => {
      // Mock getById returning an active version
      mockChainResult = {
        data: { id: "v1", status: "active", version_tag: "v1.0", plan_tier: "standard", definition: SAMPLE_DEFINITION },
        error: null,
      };

      await expect(
        PriceVersionService.updateDraft("v1", SAMPLE_DEFINITION)
      ).rejects.toThrow("only 'draft' versions are mutable");
    });

    it("activate rejects non-draft versions", async () => {
      mockChainResult = {
        data: { id: "v1", status: "archived", version_tag: "v1.0", plan_tier: "standard", definition: SAMPLE_DEFINITION },
        error: null,
      };

      await expect(
        PriceVersionService.activate("v1")
      ).rejects.toThrow("must be 'draft'");
    });
  });

  describe("createDraft", () => {
    it("calls supabase insert with correct table", async () => {
      mockChainResult = {
        data: { id: "new-v", version_tag: "v2.0", plan_tier: "standard", status: "draft", definition: SAMPLE_DEFINITION },
        error: null,
      };

      const result = await PriceVersionService.createDraft("v2.0", "standard", SAMPLE_DEFINITION);
      expect(mockFrom).toHaveBeenCalledWith("billing_price_versions");
      expect(result.status).toBe("draft");
    });
  });
});
