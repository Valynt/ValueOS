/**
 * Unit tests for EntitlementsService static accessor pattern.
 *
 * Covers the fail-open stub regression: before the fix, calling a static
 * method without a registered instance silently created a broken stub backed
 * by `{} as SupabaseClient`, which would either throw an opaque error on the
 * first DB call or, if callers caught and defaulted to allowed=true, bypass
 * quota enforcement entirely.
 *
 * After the fix, getInstance() throws a clear ConfigurationError immediately.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// Reset the singleton between tests so each test starts clean.
// We access the private field via the public setInstance() API.
import { EntitlementsService } from "../EntitlementsService.js";



afterEach(() => {
  // Reset the singleton between tests. The private field is typed as
  // EntitlementsService | null; we write null back via the public setter
  // using an unknown cast to avoid introducing a separate test-only API.
  (EntitlementsService as unknown as { _instance: null })._instance = null;
});

describe("EntitlementsService.getInstance() — no registered instance", () => {
  it("throws a ConfigurationError rather than returning a broken stub", async () => {
    // No setInstance() call — _instance is null.
    await expect(
      EntitlementsService.checkUsageAllowed("tenant-1", "agent_invocations" as never)
    ).rejects.toThrow(
      "EntitlementsService: no instance registered"
    );
  });

  it("does not silently return allowed:true when unconfigured", async () => {
    let result: { allowed: boolean } | undefined;
    try {
      result = await EntitlementsService.checkUsageAllowed("tenant-1", "agent_invocations" as never);
    } catch {
      // Expected — the important thing is we did NOT get a result
    }
    expect(result).toBeUndefined();
  });
});

describe("EntitlementsService.setInstance()", () => {
  it("allows static methods to delegate to the registered instance", async () => {
    const mockCheckUsageAllowed = vi.fn().mockResolvedValue({ allowed: true, reason: "within_quota" });
    const fakeInstance = {
      checkUsageAllowed: mockCheckUsageAllowed,
    } as unknown as EntitlementsService;

    EntitlementsService.setInstance(fakeInstance);

    const result = await EntitlementsService.checkUsageAllowed("tenant-1", "agent_invocations" as never);

    expect(mockCheckUsageAllowed).toHaveBeenCalledWith("tenant-1", "agent_invocations", 1, {});
    expect(result.allowed).toBe(true);
  });
});
