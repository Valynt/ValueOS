import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolRegistry } from "../ToolRegistry.js";

const { warnSpy, recordUsageSpy } = vi.hoisted(() => ({
  warnSpy: vi.fn(),
  recordUsageSpy: vi.fn(),
}));

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
  },
}));

vi.mock("../../policy/AuthorizationPolicyGateway.js", () => ({
  authorizationPolicyGateway: {
    authorize: vi.fn(() => ({
      allowed: true,
      decisionId: "dec_test",
      policyVersion: "policy_test",
    })),
  },
}));

vi.mock("../MetricsCollector.js", () => ({
  getMetricsCollector: () => ({
    recordUsage: recordUsageSpy,
  }),
}));

describe("ToolRegistry tenant tier rate limits", () => {
  beforeEach(() => {
    warnSpy.mockReset();
    recordUsageSpy.mockReset();
  });

  it("uses free tier limits when lookup resolves free", () => {
    const registry = new ToolRegistry({
      tenantTierLookup: () => "free",
    });

    const bucket = registry["getTokenBucket"]("tenant-free", "search");

    expect(bucket.capacity).toBe(5);
    expect(bucket.refillRate).toBe(10);
  });

  it("maps canonical professional tier to pro limits", () => {
    const registry = new ToolRegistry({
      tenantTierLookup: () => "professional",
    });

    const bucket = registry["getTokenBucket"]("tenant-pro", "search");

    expect(bucket.capacity).toBe(20);
    expect(bucket.refillRate).toBe(100);
  });

  it("uses enterprise limits when lookup resolves enterprise", () => {
    const registry = new ToolRegistry({
      tenantTierLookup: () => "enterprise",
    });

    const bucket = registry["getTokenBucket"]("tenant-enterprise", "search");

    expect(bucket.capacity).toBe(100);
    expect(bucket.refillRate).toBe(1000);
  });

  it("uses internal limits when lookup resolves internal", () => {
    const registry = new ToolRegistry({
      tenantTierLookup: () => "internal",
    });

    const bucket = registry["getTokenBucket"]("tenant-internal", "search");

    expect(bucket.capacity).toBe(500);
    expect(bucket.refillRate).toBe(10000);
  });

  it("falls back deterministically when lookup fails and emits warning + metric", () => {
    const registry = new ToolRegistry({
      tenantTierLookup: () => {
        throw new Error("lookup_unavailable");
      },
    });

    const bucket = registry["getTokenBucket"]("tenant-fallback", "search");

    expect(bucket.capacity).toBe(5);
    expect(bucket.refillRate).toBe(10);
    expect(warnSpy).toHaveBeenCalledWith(
      "tool_registry.tenant_tier_fallback",
      expect.objectContaining({
        tenantId: "tenant-fallback",
        toolName: "search",
        fallbackTier: "free",
      })
    );
    expect(recordUsageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-fallback",
        metric: "tool_registry_tier_fallback_total",
      })
    );
  });
});
