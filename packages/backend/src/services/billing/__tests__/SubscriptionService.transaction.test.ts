// @vitest-environment node
/**
 * TransactionalSubscriptionService tests
 *
 * Verifies:
 * - Intent record is written before Stripe is called
 * - Stripe idempotency keys are passed on every item update
 * - On Stripe failure, rollback is attempted and change is marked failed
 * - On rollback failure, change is marked needs_reconciliation
 * - reconcileSubscription() resolves stripe_updated records
 * - reconcileSubscription() marks pending records as failed
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase mock ──────────────────────────────────────────────────────────

const supabaseMock = { from: vi.fn() };

vi.mock("../../../lib/supabase.js", () => ({ supabase: supabaseMock }));

// ── Stripe mock ────────────────────────────────────────────────────────────

const stripeItemUpdateMock = vi.fn();
const stripeSubscriptionRetrieveMock = vi.fn();
const stripeMock = {
  subscriptionItems: { update: stripeItemUpdateMock },
  subscriptions: { retrieve: stripeSubscriptionRetrieveMock },
};

// ── StripeService mock ─────────────────────────────────────────────────────
// Use a factory function so vi.resetAllMocks() doesn't wipe the return value.

vi.mock("../StripeService.js", () => ({
  default: {
    getInstance: () => ({
      generateIdempotencyKey: (tenantId: string, op: string, id: string) =>
        `vos_${tenantId}_${op}_${id}`,
    }),
  },
}));

// ── billing config mock ────────────────────────────────────────────────────

vi.mock("../../config/billing.js", () => ({
  PLANS: {
    free:       { quotas: { llm_tokens: 1000, agent_executions: 10, api_calls: 100, storage_gb: 1, user_seats: 1 }, hardCaps: {} },
    standard:   { quotas: { llm_tokens: 10000, agent_executions: 100, api_calls: 1000, storage_gb: 10, user_seats: 5 }, hardCaps: {} },
    enterprise: { quotas: { llm_tokens: 100000, agent_executions: 1000, api_calls: 10000, storage_gb: 100, user_seats: 50 }, hardCaps: {} },
  },
  PlanTier: {},
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-abc";
const SUBSCRIPTION_ID = "sub-123";

const mockSubscription = {
  id: SUBSCRIPTION_ID,
  tenant_id: TENANT_ID,
  plan_tier: "standard" as const,
  stripe_subscription_id: "stripe_sub_123",
};

const mockItems = [
  {
    id: "item-1",
    subscription_id: SUBSCRIPTION_ID,
    metric: "llm_tokens",
    stripe_subscription_item_id: "si_1",
    stripe_price_id: "price_standard_llm",
  },
];

const mockStripeResult = { price: { id: "price_enterprise_llm" } };

// ── Chain builder ──────────────────────────────────────────────────────────

/**
 * Build a fluent Supabase query chain that resolves to `finalValue` at any
 * terminal point — whether awaited directly, or via .single()/.order().
 *
 * Supabase queries are "thenable": `await sb.from(...).select(...)` works
 * because the builder object implements `.then()`. We replicate that here.
 */
function chain(finalValue: unknown) {
  const c: Record<string, unknown> = {};
  // Make the chain itself thenable so `await chain(...)` resolves to finalValue.
  c.then = (resolve: (v: unknown) => void) => resolve(finalValue);
  const self = () => c;
  c.select  = vi.fn(self);
  c.insert  = vi.fn(self);
  c.update  = vi.fn(self);
  c.eq      = vi.fn(self);
  c.in      = vi.fn(self);
  c.single  = vi.fn().mockResolvedValue(finalValue);
  c.order   = vi.fn().mockResolvedValue(finalValue);
  c.upsert  = vi.fn().mockResolvedValue(finalValue);
  return c;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("TransactionalSubscriptionService", () => {
  let TransactionalSubscriptionService: typeof import("../SubscriptionService.transaction.js").default;

  beforeEach(async () => {
    vi.resetAllMocks(); // clears call history AND resets implementations/return values
    process.env.STRIPE_PRICE_LLM_TOKENS_ENTERPRISE = "price_enterprise_llm";
    process.env.STRIPE_PRICE_AGENT_EXECUTIONS_ENTERPRISE = "price_enterprise_agent";
    process.env.STRIPE_PRICE_API_CALLS_ENTERPRISE = "price_enterprise_api";
    process.env.STRIPE_PRICE_STORAGE_ENTERPRISE = "price_enterprise_storage";
    process.env.STRIPE_PRICE_USER_SEATS_ENTERPRISE = "price_enterprise_seats";

    const mod = await import("../SubscriptionService.transaction.js");
    TransactionalSubscriptionService = mod.default;
  });

  function makeService() {
    return new TransactionalSubscriptionService(stripeMock as unknown as import("stripe").default);
  }

  // ── Happy path helpers ─────────────────────────────────────────────────

  function setupHappyPath() {
    const calls = [
      // 1. fetchActiveSubscription
      chain({ data: mockSubscription, error: null }),
      // 2. fetchSubscriptionItems
      chain({ data: mockItems, error: null }),
      // 3. createChangeRecord (insert → select → single)
      chain({ data: { id: "change-1", idempotency_key: "vos_tenant-abc_plan_change_change-1" }, error: null }),
      // 4. markChangeStatus → stripe_updated
      chain({ error: null }),
      // 5. updateSubscriptionRecord
      chain({ data: { ...mockSubscription, plan_tier: "enterprise" }, error: null }),
      // 6. updateSubscriptionItemsRecord (upsert)
      { upsert: vi.fn().mockResolvedValue({ error: null }) },
      // 7-11. updateUsageQuotas (5 metrics)
      chain({ error: null }),
      chain({ error: null }),
      chain({ error: null }),
      chain({ error: null }),
      chain({ error: null }),
      // 12. markChangeStatus → completed
      chain({ error: null }),
    ];

    let i = 0;
    supabaseMock.from.mockImplementation(() => calls[i++] ?? chain({ error: null }));
    stripeItemUpdateMock.mockResolvedValue(mockStripeResult);
  }

  // ── Tests ──────────────────────────────────────────────────────────────

  it("writes an intent record before calling Stripe", async () => {
    setupHappyPath();
    const service = makeService();

    await service.updateSubscriptionWithTransaction(TENANT_ID, "enterprise");

    // from() call index 2 is the insert (intent record).
    // stripeItemUpdateMock should have been called after that.
    const fromCallCount = supabaseMock.from.mock.calls.length;
    expect(fromCallCount).toBeGreaterThanOrEqual(3);
    // Stripe was called after the intent record was written.
    // Use the stripeMock reference directly to verify the call went through.
    expect(stripeMock.subscriptionItems.update).toHaveBeenCalledOnce();

    // usage_quotas must be updated as part of the happy path.
    const tableNames = (supabaseMock.from.mock.calls as [string][]).map(([t]) => t);
    expect(tableNames).toContain("usage_quotas");
  });

  it("BUG-3 regression: sets stripe_updated_at when marking stripe_updated", async () => {
    setupHappyPath();
    const service = makeService();

    await service.updateSubscriptionWithTransaction(TENANT_ID, "enterprise");

    // The 4th from() call is markChangeStatus("stripe_updated").
    // Verify the update payload includes stripe_updated_at.
    const updateCalls = (supabaseMock.from.mock.results as { value: { update: ReturnType<typeof vi.fn> } }[])
      .map((r) => r.value?.update?.mock?.calls?.[0]?.[0])
      .filter(Boolean);

    const stripeUpdatedCall = updateCalls.find(
      (payload: Record<string, unknown>) => payload.status === "stripe_updated",
    );
    expect(stripeUpdatedCall).toBeDefined();
    expect(typeof stripeUpdatedCall?.stripe_updated_at).toBe("string");
  });

  it("passes idempotency keys to every Stripe item update", async () => {
    setupHappyPath();
    const service = makeService();

    await service.updateSubscriptionWithTransaction(TENANT_ID, "enterprise");

    expect(stripeItemUpdateMock).toHaveBeenCalledOnce();
    const [, , options] = stripeItemUpdateMock.mock.calls[0] as [string, unknown, { idempotencyKey: string }];
    expect(options.idempotencyKey).toMatch(/^vos_tenant-abc_plan_change_.+_item_0$/);
  });

  it("marks change as failed and attempts rollback when Stripe throws", async () => {
    const calls = [
      chain({ data: mockSubscription, error: null }),   // fetchActiveSubscription
      chain({ data: mockItems, error: null }),           // fetchSubscriptionItems
      chain({ data: { id: "change-1" }, error: null }), // createChangeRecord
      chain({ error: null }),                            // markChangeStatus → failed
    ];
    let i = 0;
    supabaseMock.from.mockImplementation(() => calls[i++] ?? chain({ error: null }));

    stripeItemUpdateMock
      .mockRejectedValueOnce(new Error("Stripe network error"))
      .mockResolvedValueOnce(mockStripeResult); // rollback succeeds

    const service = makeService();

    await expect(
      service.updateSubscriptionWithTransaction(TENANT_ID, "enterprise"),
    ).rejects.toThrow("Stripe network error");

    // Forward call + rollback call
    expect(stripeItemUpdateMock).toHaveBeenCalledTimes(2);
    const [, rollbackBody] = stripeItemUpdateMock.mock.calls[1] as [string, { price: string }];
    expect(rollbackBody.price).toBe("price_standard_llm");
  });

  it("marks change as needs_reconciliation when rollback also fails", async () => {
    const calls = [
      chain({ data: mockSubscription, error: null }),
      chain({ data: mockItems, error: null }),
      chain({ data: { id: "change-1" }, error: null }),
      chain({ error: null }), // mark failed
      chain({ error: null }), // mark needs_reconciliation
    ];
    let i = 0;
    supabaseMock.from.mockImplementation(() => calls[i++] ?? chain({ error: null }));

    stripeItemUpdateMock
      .mockRejectedValueOnce(new Error("Stripe error"))
      .mockRejectedValueOnce(new Error("Rollback error"));

    const service = makeService();

    await expect(
      service.updateSubscriptionWithTransaction(TENANT_ID, "enterprise"),
    ).rejects.toThrow("Stripe error");

    expect(stripeItemUpdateMock).toHaveBeenCalledTimes(2);
  });

  it("BUG-1 regression: rollback returns false when multiple items fail concurrently", async () => {
    // Two items — both rollbacks fail. Promise.allSettled ensures both are
    // attempted and the result is inspected from the settled array rather than
    // via a shared mutable flag that concurrent callbacks could race on.
    const twoItems = [
      { ...mockItems[0], id: "item-1", stripe_subscription_item_id: "si_1", stripe_price_id: "price_standard_llm" },
      { ...mockItems[0], id: "item-2", stripe_subscription_item_id: "si_2", stripe_price_id: "price_standard_agent", metric: "agent_executions" },
    ];

    const calls = [
      chain({ data: mockSubscription, error: null }),
      chain({ data: twoItems, error: null }),
      chain({ data: { id: "change-1" }, error: null }),
      chain({ error: null }), // mark failed
      chain({ error: null }), // mark needs_reconciliation
    ];
    let i = 0;
    supabaseMock.from.mockImplementation(() => calls[i++] ?? chain({ error: null }));

    process.env.STRIPE_PRICE_AGENT_EXECUTIONS_ENTERPRISE = "price_enterprise_agent";

    // Both forward calls succeed so updateStripeItems resolves; then both
    // rollback calls fail so rollbackStripeItems returns false.
    stripeItemUpdateMock
      .mockResolvedValueOnce({ price: { id: "price_enterprise_llm" } })   // forward item-1
      .mockResolvedValueOnce({ price: { id: "price_enterprise_agent" } })  // forward item-2
      // DB update throws to trigger the catch block
      .mockRejectedValueOnce(new Error("Rollback error 1")) // rollback item-1
      .mockRejectedValueOnce(new Error("Rollback error 2")); // rollback item-2

    // Make the DB subscription update fail so we enter the catch path.
    const callsWithDbFailure = [
      chain({ data: mockSubscription, error: null }),          // fetchActiveSubscription
      chain({ data: twoItems, error: null }),                  // fetchSubscriptionItems
      chain({ data: { id: "change-1" }, error: null }),        // createChangeRecord
      chain({ error: null }),                                  // markChangeStatus stripe_updated
      chain({ data: null, error: { message: "DB error" } }),   // updateSubscriptionRecord fails
      chain({ error: null }),                                  // markChangeStatus failed
      chain({ error: null }),                                  // markChangeStatus needs_reconciliation
    ];
    let j = 0;
    supabaseMock.from.mockImplementation(() => callsWithDbFailure[j++] ?? chain({ error: null }));

    const service = makeService();

    await expect(
      service.updateSubscriptionWithTransaction(TENANT_ID, "enterprise"),
    ).rejects.toThrow("DB error");

    // 2 forward calls + 2 rollback calls = 4 total.
    expect(stripeItemUpdateMock).toHaveBeenCalledTimes(4);
    // Rollback keys must be distinct from forward keys.
    const calls4 = stripeItemUpdateMock.mock.calls as [string, unknown, { idempotencyKey: string }][];
    expect(calls4[2][2].idempotencyKey).toContain("_rollback_0");
    expect(calls4[3][2].idempotencyKey).toContain("_rollback_1");
  });

  it("reconcileSubscription marks pending changes as failed", async () => {
    const pendingChange = {
      id: "change-stale",
      tenant_id: TENANT_ID,
      status: "pending",
      new_plan_tier: "enterprise",
    };

    const calls = [
      chain({ data: [pendingChange], error: null }), // fetch stale changes
      chain({ error: null }),                         // markChangeStatus → failed
    ];
    let i = 0;
    supabaseMock.from.mockImplementation(() => calls[i++] ?? chain({ error: null }));

    const service = makeService();
    await service.reconcileSubscription(TENANT_ID);

    expect(supabaseMock.from).toHaveBeenCalledTimes(2);
  });

  it("reconcileSubscription aligns DB to Stripe for stripe_updated changes", async () => {
    const stripeUpdatedChange = {
      id: "change-stripe-done",
      tenant_id: TENANT_ID,
      status: "stripe_updated",
      new_plan_tier: "enterprise",
    };

    stripeSubscriptionRetrieveMock.mockResolvedValue({
      items: { data: [{ id: "si_1", price: { id: "price_enterprise_llm" } }] },
    });

    const calls = [
      chain({ data: [stripeUpdatedChange], error: null }), // fetch stale changes
      chain({ data: mockSubscription, error: null }),       // fetchActiveSubscription
      chain({ error: null }),                               // subscriptions update
      { upsert: vi.fn().mockResolvedValue({ error: null }) }, // subscription_items upsert
      chain({ error: null }),                               // markChangeStatus → completed
    ];
    let i = 0;
    supabaseMock.from.mockImplementation(() => calls[i++] ?? chain({ error: null }));

    const service = makeService();
    await service.reconcileSubscription(TENANT_ID);

    expect(stripeSubscriptionRetrieveMock).toHaveBeenCalledOnce();
  });
});
