import { describe, expect, it } from "vitest";

import { WebSocketLimiter } from "./WebSocketLimiter.js";

describe("WebSocketLimiter", () => {
  it("blocks when token bucket is exhausted", () => {
    const limiter = new WebSocketLimiter({
      maxMessagesPerSecond: 2,
      maxPayloadBytes: 1024,
      refillIntervalMs: 1000,
    });

    expect(limiter.evaluateMessage("c1", "tenant-a", 10, 0).allowed).toBe(true);
    expect(limiter.evaluateMessage("c1", "tenant-a", 10, 100).allowed).toBe(true);

    const blocked = limiter.evaluateMessage("c1", "tenant-a", 10, 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("rate_limit_exceeded");
  });

  it("refills tokens after interval", () => {
    const limiter = new WebSocketLimiter({
      maxMessagesPerSecond: 1,
      maxPayloadBytes: 1024,
      refillIntervalMs: 1000,
    });

    limiter.evaluateMessage("c2", "tenant-a", 10, 0);
    expect(limiter.evaluateMessage("c2", "tenant-a", 10, 10).allowed).toBe(false);
    expect(limiter.evaluateMessage("c2", "tenant-a", 10, 1000).allowed).toBe(true);
  });

  it("blocks oversized payloads", () => {
    const limiter = new WebSocketLimiter({
      maxMessagesPerSecond: 10,
      maxPayloadBytes: 100,
    });

    const blocked = limiter.evaluateMessage("c3", "tenant-a", 101);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("payload_too_large");
  });
});
