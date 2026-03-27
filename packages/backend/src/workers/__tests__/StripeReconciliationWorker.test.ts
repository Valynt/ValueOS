/**
 * StripeReconciliationWorker — unit tests
 *
 * Covers reconcileStripeEvents() (Phase 1):
 *   - Clean run: no drift detected
 *   - Drift detected: missing events backfilled
 *   - Stripe API pagination (has_more=true across multiple pages)
 *   - Partial backfill: one event throws, others continue
 *   - DB query error propagates
 *
 * Covers worker job handler (Phase 2):
 *   - Phase 2 runs after Phase 1 and calls reconcileSubscriptionCreations
 *   - creationResolved > 0 emits a warn log and sets the gauge
 *   - Phase 2 failure causes the job to throw (BullMQ retries)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Stripe mock ───────────────────────────────────────────────────────────────

const mockStripeEventsList = vi.fn();
const mockStripeSubscriptionsCancel = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    events: { list: mockStripeEventsList },
    subscriptions: { cancel: mockStripeSubscriptionsCancel },
  })),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSupabaseSelect = vi.fn();
const mockServiceRoleClient = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      gte: vi.fn().mockImplementation(() => mockSupabaseSelect()),
    }),
  }),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue(mockServiceRoleClient),
}));

// ── WebhookService mock ───────────────────────────────────────────────────────

const mockProcessEvent = vi.fn();

vi.mock("../../services/billing/WebhookService.js", () => ({
  WebhookService: vi.fn().mockImplementation(() => ({
    processEvent: mockProcessEvent,
  })),
}));

// ── TransactionalSubscriptionService mock ────────────────────────────────────

const mockReconcileSubscriptionCreations = vi.fn();
let capturedTransactionalServiceArgs: unknown[] = [];

vi.mock("../../services/billing/SubscriptionService.transaction.js", () => ({
  TransactionalSubscriptionService: vi.fn().mockImplementation((...args: unknown[]) => {
    capturedTransactionalServiceArgs = args;
    return { reconcileSubscriptionCreations: mockReconcileSubscriptionCreations };
  }),
}));

// ── Metrics mock ──────────────────────────────────────────────────────────────

const mockCreationResolvedSet = vi.fn();

vi.mock("../../metrics/billingMetrics.js", () => ({
  webhookReconciliationRunsTotal: { inc: vi.fn() },
  webhookReconciliationFailuresTotal: { inc: vi.fn() },
  webhookReconciliationDriftCount: {
    labels: vi.fn().mockReturnValue({ set: vi.fn() }),
  },
  subscriptionCreationReconciliationResolved: { set: mockCreationResolvedSet },
}));

// ── Config mock ───────────────────────────────────────────────────────────────

vi.mock("../../config/billing.js", () => ({
  STRIPE_CONFIG: { apiVersion: "2023-10-16" },
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("../../lib/logger.js", () => ({
  createLogger: vi.fn().mockReturnValue(mockLogger),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStripeEvent(id: string, type = "invoice.payment_succeeded") {
  return {
    id,
    type,
    object: "event",
    created: Math.floor(Date.now() / 1000) - 3600,
    data: { object: {} },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: "2023-10-16",
  };
}

function makeStripePage(events: ReturnType<typeof makeStripeEvent>[], hasMore = false) {
  return { data: events, has_more: hasMore };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("reconcileStripeEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: STRIPE_SECRET_KEY set
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.SUPABASE_URL = "http://localhost";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  it("returns 0 and does not call processEvent when there is no drift", async () => {
    const events = [makeStripeEvent("evt_001"), makeStripeEvent("evt_002")];
    mockStripeEventsList.mockResolvedValue(makeStripePage(events));
    // DB has both events
    mockSupabaseSelect.mockResolvedValue({
      data: [{ stripe_event_id: "evt_001" }, { stripe_event_id: "evt_002" }],
      error: null,
    });

    const { reconcileStripeEvents } = await import("../StripeReconciliationWorker.js");
    const backfilled = await reconcileStripeEvents(24);

    expect(backfilled).toBe(0);
    expect(mockProcessEvent).not.toHaveBeenCalled();
  });

  it("backfills events present in Stripe but missing from DB", async () => {
    const events = [
      makeStripeEvent("evt_001"),
      makeStripeEvent("evt_002"),
      makeStripeEvent("evt_003"),
    ];
    mockStripeEventsList.mockResolvedValue(makeStripePage(events));
    // DB only has evt_001
    mockSupabaseSelect.mockResolvedValue({
      data: [{ stripe_event_id: "evt_001" }],
      error: null,
    });
    mockProcessEvent.mockResolvedValue(false);

    const { reconcileStripeEvents } = await import("../StripeReconciliationWorker.js");
    const backfilled = await reconcileStripeEvents(24);

    expect(backfilled).toBe(2);
    expect(mockProcessEvent).toHaveBeenCalledTimes(2);
    const calledIds = mockProcessEvent.mock.calls.map((c) => c[0].id);
    expect(calledIds).toContain("evt_002");
    expect(calledIds).toContain("evt_003");
  });

  it("handles Stripe API pagination (has_more=true)", async () => {
    const page1 = [makeStripeEvent("evt_p1_001"), makeStripeEvent("evt_p1_002")];
    const page2 = [makeStripeEvent("evt_p2_001")];

    mockStripeEventsList
      .mockResolvedValueOnce(makeStripePage(page1, true))  // first page, has_more
      .mockResolvedValueOnce(makeStripePage(page2, false)); // second page, done

    // DB is empty — all 3 events are missing
    mockSupabaseSelect.mockResolvedValue({ data: [], error: null });
    mockProcessEvent.mockResolvedValue(false);

    const { reconcileStripeEvents } = await import("../StripeReconciliationWorker.js");
    const backfilled = await reconcileStripeEvents(24);

    expect(mockStripeEventsList).toHaveBeenCalledTimes(2);
    // Second call must use starting_after = last id of page 1
    expect(mockStripeEventsList.mock.calls[1][0]).toMatchObject({
      starting_after: "evt_p1_002",
    });
    expect(backfilled).toBe(3);
  });

  it("continues backfilling remaining events when one processEvent throws", async () => {
    const events = [
      makeStripeEvent("evt_fail"),
      makeStripeEvent("evt_ok_1"),
      makeStripeEvent("evt_ok_2"),
    ];
    mockStripeEventsList.mockResolvedValue(makeStripePage(events));
    mockSupabaseSelect.mockResolvedValue({ data: [], error: null });

    mockProcessEvent
      .mockRejectedValueOnce(new Error("handler error"))
      .mockResolvedValue(false);

    const { reconcileStripeEvents } = await import("../StripeReconciliationWorker.js");
    const backfilled = await reconcileStripeEvents(24);

    // 2 succeeded despite 1 failure
    expect(backfilled).toBe(2);
    expect(mockProcessEvent).toHaveBeenCalledTimes(3);
  });

  it("throws when the DB query fails", async () => {
    mockStripeEventsList.mockResolvedValue(
      makeStripePage([makeStripeEvent("evt_001")])
    );
    mockSupabaseSelect.mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });

    const { reconcileStripeEvents } = await import("../StripeReconciliationWorker.js");
    await expect(reconcileStripeEvents(24)).rejects.toThrow("Failed to query webhook_events");
  });

  it("returns 0 immediately when Stripe returns no events in the window", async () => {
    mockStripeEventsList.mockResolvedValue(makeStripePage([]));

    const { reconcileStripeEvents } = await import("../StripeReconciliationWorker.js");
    const backfilled = await reconcileStripeEvents(24);

    expect(backfilled).toBe(0);
    expect(mockSupabaseSelect).not.toHaveBeenCalled();
    expect(mockProcessEvent).not.toHaveBeenCalled();
  });
});

// ── runReconciliationJob (Phase 1 + Phase 2) ──────────────────────────────────

describe("runReconciliationJob", () => {
  const fakeJob = { id: "job-1", data: { scheduledAt: new Date().toISOString(), windowHours: 24 } };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.SUPABASE_URL = "http://localhost";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    // Phase 1: no Stripe events → returns 0 immediately, no DB call needed
    mockStripeEventsList.mockResolvedValue(makeStripePage([]));
  });

  it("runs Phase 2 after Phase 1 and sets the resolved gauge", async () => {
    mockReconcileSubscriptionCreations.mockResolvedValue(0);

    const { runReconciliationJob } = await import("../StripeReconciliationWorker.js");
    await runReconciliationJob(fakeJob);

    expect(mockReconcileSubscriptionCreations).toHaveBeenCalledOnce();
    expect(mockCreationResolvedSet).toHaveBeenCalledWith(0);
  });

  it("passes the service-role Supabase client to TransactionalSubscriptionService", async () => {
    mockReconcileSubscriptionCreations.mockResolvedValue(0);

    const { runReconciliationJob } = await import("../StripeReconciliationWorker.js");
    await runReconciliationJob(fakeJob);

    // The second constructor argument must be the service-role client returned
    // by createClient(), not the anon client from lib/supabase.js.
    expect(capturedTransactionalServiceArgs[1]).toBe(mockServiceRoleClient);
  });

  it("emits a warn log when Phase 2 cancels orphaned subscriptions", async () => {
    mockReconcileSubscriptionCreations.mockResolvedValue(3);

    const { runReconciliationJob } = await import("../StripeReconciliationWorker.js");
    await runReconciliationJob(fakeJob);

    expect(mockCreationResolvedSet).toHaveBeenCalledWith(3);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Reconciliation: cancelled orphaned Stripe subscriptions",
      expect.objectContaining({ creationResolved: 3 }),
    );
  });

  it("throws and increments failure counter when Phase 2 throws", async () => {
    mockReconcileSubscriptionCreations.mockRejectedValue(new Error("DB unavailable"));

    const { runReconciliationJob } = await import("../StripeReconciliationWorker.js");
    await expect(runReconciliationJob(fakeJob)).rejects.toThrow("DB unavailable");

    // Failure counter must be incremented so BullMQ retry logic fires
    const { webhookReconciliationFailuresTotal } = await import("../../metrics/billingMetrics.js");
    expect(webhookReconciliationFailuresTotal.inc).toHaveBeenCalled();
  });
});
