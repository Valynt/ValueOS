/**
 * audit-logger-server-side-delivery — unit test
 *
 * Confirms that logSecurityEvent (services/security/auditLogger.ts) calls
 * auditLogService.logAudit for server-side persistence and does NOT access
 * browser-only APIs like navigator.sendBeacon.
 *
 * Background: The audit logger was previously using navigator.sendBeacon
 * which silently dropped all server-side security events. It was replaced
 * with direct auditLogService.logAudit() calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock auditLogService ─────────────────────────────────────────────────────
const mockLogAudit = vi.fn().mockResolvedValue({ id: "audit-1" });

vi.mock("../AuditLogService.js", () => ({
  auditLogService: {
    logAudit: mockLogAudit,
  },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
const { logSecurityEvent } = await import("../auditLogger.js");

// ── Tests ────────────────────────────────────────────────────────────────────
describe("audit-logger-server-side-delivery", () => {
  let originalNavigator: typeof globalThis.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
    // Save original navigator and replace with a spy-instrumented version
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    // Restore navigator
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("calls auditLogService.logAudit when logSecurityEvent is invoked", async () => {
    await logSecurityEvent({
      action: "test_action",
      resource: "test_resource",
      outcome: "success",
      severity: "low",
      userId: "user-123",
      timestamp: new Date().toISOString(),
    });

    expect(mockLogAudit).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        action: "test_action",
        resourceId: "test_resource",
        status: "success",
      })
    );
  });

  it("does NOT access navigator.sendBeacon", async () => {
    // Set up a trap: if anything touches navigator.sendBeacon, the test fails
    const sendBeaconSpy = vi.fn();
    Object.defineProperty(globalThis, "navigator", {
      value: { sendBeacon: sendBeaconSpy },
      writable: true,
      configurable: true,
    });

    await logSecurityEvent({
      action: "beacon_check",
      resource: "test",
      outcome: "success",
      severity: "low",
      timestamp: new Date().toISOString(),
    });

    expect(sendBeaconSpy).not.toHaveBeenCalled();
    // Verify it still used the correct server-side path
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
  });

  it("maps blocked outcome to failed status", async () => {
    await logSecurityEvent({
      action: "access_denied",
      resource: "sensitive_resource",
      outcome: "blocked",
      severity: "medium",
      userId: "attacker-1",
      timestamp: new Date().toISOString(),
    });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      })
    );
  });

  it("does not throw when auditLogService.logAudit fails", async () => {
    mockLogAudit.mockRejectedValueOnce(new Error("DB connection failed"));

    // Should not throw
    await expect(
      logSecurityEvent({
        action: "should_not_throw",
        resource: "test",
        outcome: "success",
        severity: "low",
        timestamp: new Date().toISOString(),
      })
    ).resolves.toBeUndefined();
  });
});
