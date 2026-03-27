/**
 * RatingEngine Tests
 *
 * Validates deterministic rating, overage calculation, and idempotent storage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntitlementSnapshot } from "../EntitlementSnapshotService";
import type { PriceVersionDefinition } from "../PriceVersionService";
import type { RatingContext, UsageAggregate } from "../RatingEngine";

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockSelectResult: { data: unknown; error: unknown } = { data: [], error: null };
const mockFrom = vi.fn();

const createChain = (): Record<string, unknown> => {
  const chain: Record<string, unknown> = {};
  const methods = ["eq", "order"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => {
    // insert returns the chain but resolves to mockInsertResult
    const insertChain: Record<string, unknown> = {};
    insertChain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(mockInsertResult).then(resolve, reject);
    return insertChain;
  });
  // For select queries (getRatedLineItems)
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    Promise.resolve(mockSelectResult).then(resolve, reject);
  return chain;
};

vi.mock("../../../lib/supabase.js", () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return createChain();
    },
  },
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const STANDARD_DEFINITION: PriceVersionDefinition = {
  name: "Standard",
  price_usd: 99,
  billing_period: "monthly",
  meters: {
    ai_tokens: { included_quantity: 1000000, hard_cap_quantity: null, overage_rate: 0.00001, enforcement: "bill_overage" },
    api_calls: { included_quantity: 100000, hard_cap_quantity: null, overage_rate: 0.001, enforcement: "bill_overage" },
    storage_gb: { included_quantity: 100, hard_cap_quantity: null, overage_rate: 0.5, enforcement: "bill_overage" },
  },
  features: [],
};

const PRICE_VERSION = {
  id: "pv-1",
  version_tag: "v1.0",
  plan_tier: "standard",
  definition: STANDARD_DEFINITION,
  status: "active" as const,
  activated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const ENTITLEMENT_SNAPSHOT: EntitlementSnapshot = {
  id: "snap-1",
  tenant_id: "t-1",
  subscription_id: "sub-1",
  price_version_id: "pv-1",
  entitlements: {
    ai_tokens: { included: 1000000, cap: null, overage_rate: 0.00001, enforcement: "bill_overage" },
    api_calls: { included: 100000, cap: null, overage_rate: 0.001, enforcement: "bill_overage" },
  },
  effective_at: "2026-01-01T00:00:00Z",
  superseded_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

function makeContext(aggregates: UsageAggregate[]): RatingContext {
  return {
    tenantId: "t-1",
    subscriptionId: "sub-1",
    priceVersion: PRICE_VERSION,
    entitlementSnapshot: ENTITLEMENT_SNAPSHOT,
    periodStart: new Date("2026-02-01T00:00:00Z"),
    periodEnd: new Date("2026-03-01T00:00:00Z"),
    usageAggregates: aggregates,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RatingEngine", () => {
  let RatingEngine: new (supabase: unknown) => Record<string, (...args: unknown[]) => Promise<unknown>>;
  let engine: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockInsertResult = { data: null, error: null };
    mockSelectResult = { data: [], error: null };
    const mod = await import("../RatingEngine");
    RatingEngine = mod.default as unknown as typeof RatingEngine;
    engine = new RatingEngine({
      from: (table: string) => {
        mockFrom(table);
        return createChain();
      },
    });
  });

  describe("rateSubscriptionPeriod", () => {
    it("produces zero amount when usage is within included quantity", async () => {
      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 500000, // Under 1M included
          source_event_count: 100,
          source_hash: "abc123",
        },
      ];

      const result = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: Array<{ amount: number; quantity_overage: number; quantity_used: number }>;
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].quantity_overage).toBe(0);
      expect(result.lineItems[0].amount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it("calculates overage correctly when usage exceeds included quantity", async () => {
      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 1500000, // 500K over 1M included
          source_event_count: 200,
          source_hash: "def456",
        },
      ];

      const result = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: Array<{ amount: number; quantity_overage: number; unit_price: number }>;
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(1);
      const item = result.lineItems[0];
      expect(item.quantity_overage).toBe(500000);
      expect(item.unit_price).toBe(0.00001);
      // 500000 * 0.00001 = 5.0
      expect(item.amount).toBe(5);
      expect(result.totalAmount).toBe(5);
    });

    it("handles multiple meters in a single rating", async () => {
      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 2000000, // 1M overage
          source_event_count: 300,
          source_hash: "hash1",
        },
        {
          tenant_id: "t-1",
          meter_key: "api_calls",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 150000, // 50K overage
          source_event_count: 150,
          source_hash: "hash2",
        },
      ];

      const result = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: Array<{ meter_key: string; amount: number }>;
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(2);
      // ai_tokens: 1M * 0.00001 = 10
      // api_calls: 50K * 0.001 = 50
      expect(result.totalAmount).toBe(60);
    });

    it("skips meters not in price version definition", async () => {
      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "unknown_meter" as "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 1000,
          source_event_count: 10,
          source_hash: "hash3",
        },
      ];

      const result = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: unknown[];
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(0);
      expect(result.totalAmount).toBe(0);
    });

    it("handles zero usage", async () => {
      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 0,
          source_event_count: 0,
          source_hash: "hash4",
        },
      ];

      const result = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: Array<{ amount: number; quantity_used: number }>;
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].quantity_used).toBe(0);
      expect(result.lineItems[0].amount).toBe(0);
    });

    it("handles empty aggregates", async () => {
      const result = await engine.rateSubscriptionPeriod(makeContext([])) as {
        lineItems: unknown[];
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  describe("determinism", () => {
    it("produces same line item IDs for same inputs", async () => {
      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 1500000,
          source_event_count: 200,
          source_hash: "deterministic-hash",
        },
      ];

      const result1 = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: Array<{ id: string }>;
      };
      const result2 = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: Array<{ id: string }>;
      };

      expect(result1.lineItems[0].id).toBe(result2.lineItems[0].id);
    });
  });

  describe("idempotent storage", () => {
    it("handles duplicate key errors gracefully", async () => {
      mockInsertResult = {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      };

      const aggregates: UsageAggregate[] = [
        {
          tenant_id: "t-1",
          meter_key: "ai_tokens",
          period_start: "2026-02-01T00:00:00Z",
          period_end: "2026-03-01T00:00:00Z",
          total_quantity: 1500000,
          source_event_count: 200,
          source_hash: "dup-hash",
        },
      ];

      // Should not throw — duplicate inserts are expected for idempotency
      const result = await engine.rateSubscriptionPeriod(makeContext(aggregates)) as {
        lineItems: unknown[];
        totalAmount: number;
      };

      expect(result.lineItems).toHaveLength(1);
      expect(result.totalAmount).toBe(5);
    });
  });

  it("generates collision-free deterministic IDs for 100k synthetic entries", () => {
    const ids = new Set<string>();
    const baseContext = makeContext([]);
    for (let i = 0; i < 100_000; i++) {
      const aggregate: UsageAggregate = {
        tenant_id: "t-1",
        meter_key: "ai_tokens",
        period_start: "2026-02-01T00:00:00Z",
        period_end: "2026-03-01T00:00:00Z",
        total_quantity: i,
        source_event_count: 1,
        source_hash: `hash-${i}`,
      };
      const id = (engine as unknown as { generateDeterministicId: (ctx: RatingContext, agg: UsageAggregate) => string })
        .generateDeterministicId(baseContext, aggregate);
      ids.add(id);
    }
    expect(ids.size).toBe(100_000);
  });
});
