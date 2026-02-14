import { describe, expect, it } from "vitest";
import { RateLimitKeyService } from "../RateLimitKeyService";

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    headers: {},
    ip: "198.51.100.7",
    socket: { remoteAddress: "198.51.100.8" },
    ...overrides,
  }) as any;

describe("RateLimitKeyService header trust", () => {
  it("ignores forged x-tenant-id when service identity is unverified", () => {
    const key = RateLimitKeyService.generateKey(
      makeReq({
        headers: { "x-tenant-id": "forged-tenant" },
      }),
      { service: "general", tier: "standard" }
    );

    expect(key).toBe("rl:general:standard:198.51.100.7");
  });

  it("allows x-tenant-id only when service identity is verified", () => {
    const key = RateLimitKeyService.generateKey(
      makeReq({
        headers: { "x-tenant-id": "trusted-tenant" },
        serviceIdentityVerified: true,
      }),
      { service: "general", tier: "standard" }
    );

    expect(key).toBe("rl:general:standard:trusted-tenant:198.51.100.7");
  });

  it("ignores forged x-forwarded-for when deriving client IP", () => {
    const key = RateLimitKeyService.generateKey(
      makeReq({
        headers: { "x-forwarded-for": "203.0.113.10" },
        ip: "198.51.100.7",
      }),
      { service: "general", tier: "standard" }
    );

    expect(key).toBe("rl:general:standard:198.51.100.7");
  });
});
