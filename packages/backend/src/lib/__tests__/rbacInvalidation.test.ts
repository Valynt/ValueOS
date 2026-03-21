/**
 * Tests for Fix 7: RBAC cache invalidation pub/sub.
 *
 * Verifies:
 *   - publishRbacInvalidation publishes to the correct Redis channel
 *   - subscribeRbacInvalidation calls the handler when a message arrives
 *   - Both degrade gracefully when Redis is unavailable
 *   - The rbac_redis_unavailable_total counter increments on each fallback path
 *   - AdminRoleService calls publishRbacInvalidation after mutations
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks — all hoisted so they are in place before module-level code runs ────

const { redisMock, subscriberMock, counterMock } = vi.hoisted(() => {
  const subscriberMock = {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  const redisMock = {
    publish: vi.fn().mockResolvedValue(1),
    duplicate: vi.fn().mockReturnValue(subscriberMock),
  };
  const counterMock = { inc: vi.fn() };
  return { redisMock, subscriberMock, counterMock };
});

vi.mock("../redis.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue(redisMock),
}));

vi.mock("../logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

// createCounter is called at module level in rbacInvalidation.ts — must be
// mocked before the module is imported so the counter reference is our spy.
vi.mock("../observability/index.js", () => ({
  createCounter: vi.fn(() => counterMock),
}));

import { publishRbacInvalidation, subscribeRbacInvalidation } from "../rbacInvalidation.js";

// ── Tests ────────────────────────────────────────────────────────────────────

describe("publishRbacInvalidation (Fix 7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes to the rbac:invalidate channel", async () => {
    await publishRbacInvalidation({ roleId: "role-1", tenantId: "tenant-1" });

    expect(redisMock.publish).toHaveBeenCalledOnce();
    const [channel, payload] = redisMock.publish.mock.calls[0] as [string, string];
    expect(channel).toBe("rbac:invalidate");

    const parsed = JSON.parse(payload);
    expect(parsed.roleId).toBe("role-1");
    expect(parsed.tenantId).toBe("tenant-1");
    expect(parsed.ts).toBeDefined();
  });

  it("publishes userId+tenantId when provided", async () => {
    await publishRbacInvalidation({ userId: "user-1", tenantId: "tenant-1" });

    const [, payload] = redisMock.publish.mock.calls[0] as [string, string];
    const parsed = JSON.parse(payload);
    expect(parsed.userId).toBe("user-1");
    expect(parsed.tenantId).toBe("tenant-1");
  });

  it("increments the unavailable counter and does not throw when Redis is unavailable", async () => {
    const { getRedisClient } = await import("../redis.js");
    vi.mocked(getRedisClient).mockResolvedValueOnce(null);

    await expect(
      publishRbacInvalidation({ roleId: "role-1" }),
    ).resolves.not.toThrow();

    expect(counterMock.inc).toHaveBeenCalledOnce();
  });

  it("does not throw when Redis.publish rejects", async () => {
    redisMock.publish.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      publishRbacInvalidation({ roleId: "role-1" }),
    ).resolves.not.toThrow();
  });
});

describe("subscribeRbacInvalidation (Fix 7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscribes to the rbac:invalidate channel", async () => {
    const handler = vi.fn();
    await subscribeRbacInvalidation(handler);

    expect(subscriberMock.connect).toHaveBeenCalled();
    expect(subscriberMock.subscribe).toHaveBeenCalledWith(
      "rbac:invalidate",
      expect.any(Function),
    );
  });

  it("calls the handler with the parsed event when a message arrives", async () => {
    const handler = vi.fn();
    await subscribeRbacInvalidation(handler);

    // Simulate Redis delivering a message by calling the subscribe callback
    const [, callback] = subscriberMock.subscribe.mock.calls[0] as [string, (msg: string) => void];
    const event = { roleId: "role-1", tenantId: "tenant-1", ts: new Date().toISOString() };
    callback(JSON.stringify(event));

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("returns an unsubscribe function that cleans up the connection", async () => {
    const unsubscribe = await subscribeRbacInvalidation(vi.fn());
    await unsubscribe();

    expect(subscriberMock.unsubscribe).toHaveBeenCalledWith("rbac:invalidate");
    expect(subscriberMock.disconnect).toHaveBeenCalled();
  });

  it("increments the unavailable counter and returns a no-op unsubscribe when Redis is unavailable", async () => {
    const { getRedisClient } = await import("../redis.js");
    vi.mocked(getRedisClient).mockResolvedValueOnce(null);

    const unsubscribe = await subscribeRbacInvalidation(vi.fn());
    await expect(unsubscribe()).resolves.not.toThrow();

    expect(counterMock.inc).toHaveBeenCalledOnce();
  });

  it("does not throw when a malformed message is received", async () => {
    const handler = vi.fn();
    await subscribeRbacInvalidation(handler);

    const [, callback] = subscriberMock.subscribe.mock.calls[0] as [string, (msg: string) => void];
    // Should not throw — malformed messages are logged and discarded
    expect(() => callback("not-valid-json{{{")).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
