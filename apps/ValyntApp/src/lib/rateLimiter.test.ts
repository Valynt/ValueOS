import { describe, expect, it } from "vitest";

import {
  AuthRateLimitError,
  parseAuthLockoutMetadata,
} from "./rateLimiter";

describe("parseAuthLockoutMetadata", () => {
  it("parses top-level lockout metadata", () => {
    expect(
      parseAuthLockoutMetadata({
        locked: true,
        retryAfterSeconds: 120,
        remainingAttempts: 0,
      }),
    ).toEqual({
      locked: true,
      retryAfterSeconds: 120,
      remainingAttempts: 0,
    });
  });

  it("parses nested lockout metadata", () => {
    expect(
      parseAuthLockoutMetadata({
        lockout: {
          locked: true,
          retryAfterSeconds: 45,
          remainingAttempts: 1,
        },
      }),
    ).toEqual({
      locked: true,
      retryAfterSeconds: 45,
      remainingAttempts: 1,
    });
  });

  it("returns undefined when lockout metadata is absent", () => {
    expect(parseAuthLockoutMetadata({ retryAfterSeconds: 45 })).toBeUndefined();
  });
});

describe("AuthRateLimitError", () => {
  it("carries authoritative lockout contract for UI handling", () => {
    const error = new AuthRateLimitError(
      "Too many login attempts",
      { locked: true, retryAfterSeconds: 60, remainingAttempts: 0 },
      429,
    );

    expect(error.lockout.locked).toBe(true);
    expect(error.lockout.retryAfterSeconds).toBe(60);
    expect(error.lockout.remainingAttempts).toBe(0);
    expect(error.status).toBe(429);
  });
});
