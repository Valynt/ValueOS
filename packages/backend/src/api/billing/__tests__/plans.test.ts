/**
 * Tests for the billing plans endpoint.
 *
 * Covers:
 *   - resolveTier: unknown/null/legacy values default to 'free'
 *   - eligiblePlans: each tier sees only its own tier and above
 *   - GET /: 401 without tenantId, correct plan list per tier
 *   - GET /:planId: 401 without tenantId, 404 for unknown plan,
 *     403 when requesting a lower tier, 200 for eligible plan
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock SubscriptionService before importing the router.
// ---------------------------------------------------------------------------

const mockGetActiveSubscription = vi.fn();

vi.mock("../../../services/billing/SubscriptionService.js", () => ({
  subscriptionService: {
    getActiveSubscription: mockGetActiveSubscription,
  },
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeApp(tenantId?: string) {
  const express = (await import("express")).default;
  const { default: plansRouter } = await import("../plans.js");

  const app = express();
  app.use((req: import("express").Request, _res: unknown, next: () => void) => {
    if (tenantId) (req as Record<string, unknown>).tenantId = tenantId;
    next();
  });
  app.use("/", plansRouter);
  return app;
}

// ---------------------------------------------------------------------------
// GET /billing/plans
// ---------------------------------------------------------------------------

describe("GET /billing/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when tenantId is absent", async () => {
    const { default: request } = await import("supertest");
    const app = await makeApp(); // no tenantId
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
  });

  it("defaults to free tier when tenant has no active subscription", async () => {
    mockGetActiveSubscription.mockResolvedValue(null);
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-1");
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.current_tier).toBe("free");
    const ids = res.body.plans.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["free", "standard", "enterprise"]);
  });

  it("defaults to free tier when plan_tier is an unrecognised legacy value", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "starter" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-1");
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.current_tier).toBe("free");
  });

  it("free tenant sees free, standard, and enterprise plans", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "free" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-free");
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    const ids = res.body.plans.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["free", "standard", "enterprise"]);
    const current = res.body.plans.find((p: { id: string }) => p.id === "free");
    expect(current.is_current).toBe(true);
  });

  it("standard tenant sees only standard and enterprise plans", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "standard" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-standard");
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    const ids = res.body.plans.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["standard", "enterprise"]);
    expect(res.body.current_tier).toBe("standard");
  });

  it("enterprise tenant sees only the enterprise plan", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "enterprise" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-enterprise");
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    const ids = res.body.plans.map((p: { id: string }) => p.id);
    expect(ids).toEqual(["enterprise"]);
  });

  it("marks exactly one plan as is_current", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "standard" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-standard");
    const res = await request(app).get("/");
    const currentPlans = res.body.plans.filter((p: { is_current: boolean }) => p.is_current);
    expect(currentPlans).toHaveLength(1);
    expect(currentPlans[0].id).toBe("standard");
  });

  it("returns 500 when getActiveSubscription throws", async () => {
    mockGetActiveSubscription.mockRejectedValue(new Error("db error"));
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-1");
    const res = await request(app).get("/");
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /billing/plans/:planId
// ---------------------------------------------------------------------------

describe("GET /billing/plans/:planId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when tenantId is absent", async () => {
    const { default: request } = await import("supertest");
    const app = await makeApp();
    const res = await request(app).get("/standard");
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown plan id", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "free" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-1");
    const res = await request(app).get("/professional");
    expect(res.status).toBe(404);
  });

  it("returns 403 when a standard tenant requests the free plan", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "standard" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-standard");
    const res = await request(app).get("/free");
    expect(res.status).toBe(403);
  });

  it("returns 403 when an enterprise tenant requests the standard plan", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "enterprise" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-enterprise");
    const res = await request(app).get("/standard");
    expect(res.status).toBe(403);
  });

  it("returns 200 for a free tenant requesting the free plan", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "free" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-free");
    const res = await request(app).get("/free");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("free");
    expect(res.body.is_current).toBe(true);
  });

  it("returns 200 for a free tenant requesting the enterprise plan", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "free" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-free");
    const res = await request(app).get("/enterprise");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("enterprise");
    expect(res.body.is_current).toBe(false);
  });

  it("returns 200 for a standard tenant requesting the enterprise plan", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "standard" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-standard");
    const res = await request(app).get("/enterprise");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("enterprise");
  });

  it("response includes expected shape (limits, features, price)", async () => {
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "free" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-free");
    const res = await request(app).get("/standard");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "standard",
      tier: "standard",
      currency: "usd",
      limits: expect.objectContaining({
        llm_tokens: expect.any(Number),
        api_calls: expect.any(Number),
        user_seats: expect.any(Number),
      }),
      features: expect.any(Array),
    });
  });

  it("defaults to free tier for unknown plan_tier when checking eligibility", async () => {
    // Legacy tier value — treated as free, so requesting 'standard' is allowed.
    mockGetActiveSubscription.mockResolvedValue({ plan_tier: "legacy_basic" });
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-legacy");
    const res = await request(app).get("/standard");
    expect(res.status).toBe(200);
  });

  it("returns 500 when getActiveSubscription throws", async () => {
    mockGetActiveSubscription.mockRejectedValue(new Error("db error"));
    const { default: request } = await import("supertest");
    const app = await makeApp("tenant-1");
    const res = await request(app).get("/standard");
    expect(res.status).toBe(500);
  });
});
