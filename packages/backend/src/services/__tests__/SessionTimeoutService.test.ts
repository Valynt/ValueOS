/**
 * Session Timeout Service Tests
 *
 * Tests for AUTH-004 role-based session timeouts
 */

import { beforeEach, describe, expect, it } from "vitest";

import { getSessionTimeoutForRole } from "../../security/SecurityConfig.js";
import { SessionTimeoutService } from "../auth/SessionTimeoutService.js";

describe("SessionTimeoutService", () => {
  let service: SessionTimeoutService;

  beforeEach(() => {
    service = new SessionTimeoutService();
  });

  describe("Role-based timeout configuration", () => {
    it("should return super_admin config with correct values", () => {
      const config = getSessionTimeoutForRole("super_admin");
      expect(config.idleTimeout).toBe(900000); // 15 minutes
      expect(config.absoluteTimeout).toBe(1800000); // 30 minutes
    });

    it("should return admin config with correct values", () => {
      const adminConfig = getSessionTimeoutForRole("admin");
      expect(adminConfig.idleTimeout).toBe(15 * 60 * 1000); // 15 min
      expect(adminConfig.absoluteTimeout).toBe(30 * 60 * 1000); // 30 min
      expect(adminConfig.warningThreshold).toBe(90000); // 1.5 min
      expect(adminConfig.renewalThreshold).toBe(45000); // 45 sec
    });

    it("should return user config with correct values", () => {
      const userConfig = getSessionTimeoutForRole("user");
      expect(userConfig.idleTimeout).toBe(60 * 60 * 1000); // 60 min
      expect(userConfig.absoluteTimeout).toBe(24 * 60 * 60 * 1000); // 24 hr
    });

    it("should return member config with correct values", () => {
      const memberConfig = getSessionTimeoutForRole("member");
      expect(memberConfig.idleTimeout).toBe(1800000); // 30 minutes
      expect(memberConfig.absoluteTimeout).toBe(3600000); // 1 hour
    });

    it("should return guest config with correct values", () => {
      const guestConfig = getSessionTimeoutForRole("guest");
      expect(guestConfig.idleTimeout).toBe(600000); // 10 minutes
      expect(guestConfig.absoluteTimeout).toBe(1800000); // 30 minutes
    });

    it("should fallback to member config for unknown role", () => {
      const config = getSessionTimeoutForRole("unknown_role");
      expect(config.idleTimeout).toBe(30 * 60 * 1000);
      expect(config.absoluteTimeout).toBe(60 * 60 * 1000);
    });
  });

  describe("checkSession", () => {
    it("should mark session as valid within timeouts (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "member",
        createdAt: now - 60000, // 1 minute ago
        lastActivity: now - 30000, // 30 seconds ago
      };

      const status = service.checkSession(session, now);

      expect(status.valid).toBe(true);
      expect(status.reason).toBe("active");
    });

    it("should detect idle timeout (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "user",
        createdAt: now - 1200000,
        lastActivity: now - 3600001, // 60+ minutes ago (> 60min idle timeout)
      };

      const status = service.checkSession(session, now);

      expect(status.valid).toBe(false);
      expect(status.reason).toBe("idle_timeout");
    });

    it("should detect absolute timeout (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: now - 2000000, // 33+ minutes ago (admin absolute: 30min)
        lastActivity: now - 60000, // 1 minute ago (within idle limit)
      };

      const status = service.checkSession(session, now);

      expect(status.valid).toBe(false);
      expect(status.reason).toBe("absolute_timeout");
    });

    it("should trigger warning before expiry (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: now - 1725000, // 28.75 minutes ago (> 28.5min triggers warning)
        lastActivity: now - 60000,
      };

      const status = service.checkSession(session, now);

      expect(status.valid).toBe(true);
      expect(status.shouldWarn).toBe(true);
    });

    it("should trigger auto-renewal before expiry (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "member",
        createdAt: now - 3540000, // 59 minutes ago (> 58.5min triggers renewal)
        lastActivity: now - 60000, // 1 minute ago (within idle limit)
      };

      const status = service.checkSession(session, now);

      expect(status.valid).toBe(true);
      expect(status.shouldRenew).toBe(true);
    });
  });

  describe("updateActivity", () => {
    it("should update lastActivity timestamp (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "member",
        createdAt: now - 600000,
        lastActivity: now - 300000,
      };

      const updated = service.updateActivity(session, now);

      expect(updated.lastActivity).toBe(now); // Exact equality, no race condition
      expect(updated.userId).toBe(session.userId);
      expect(updated.lastActivity).toBeGreaterThan(session.lastActivity);
    });
  });

  describe("renewSession", () => {
    it("should reset activity and set renewedAt (deterministic)", () => {
      const now = 1704067200000; // Fixed timestamp for 99.9% reliability
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: now - 1500000,
        lastActivity: now - 1200000,
      };

      const renewed = service.renewSession(session, now);

      expect(renewed.renewedAt).toBe(now); // Exact equality, no race condition
      expect(renewed.lastActivity).toBe(now);
      expect(renewed.lastActivity).toBeGreaterThan(session.lastActivity);
    });
  });

  describe("formatTimeRemaining", () => {
    it("should format hours and minutes", () => {
      const formatted = service.formatTimeRemaining(3665000); // 1h 1m 5s
      expect(formatted).toBe("1h 1m");
    });

    it("should format minutes and seconds", () => {
      const formatted = service.formatTimeRemaining(125000); // 2m 5s
      expect(formatted).toBe("2m 5s");
    });

    it("should format seconds only", () => {
      const formatted = service.formatTimeRemaining(45000); // 45s
      expect(formatted).toBe("45s");
    });
  });

  describe("Timeout hierarchy", () => {
    it("should have admin timeout <= manager timeout", () => {
      const adminConfig = getSessionTimeoutForRole("admin");
      const managerConfig = getSessionTimeoutForRole("manager");

      expect(adminConfig.idleTimeout).toBeLessThanOrEqual(
        managerConfig.idleTimeout
      );
      expect(adminConfig.absoluteTimeout).toBeLessThanOrEqual(
        managerConfig.absoluteTimeout
      );
    });

    it("should have manager timeout <= member timeout", () => {
      const managerConfig = getSessionTimeoutForRole("manager");
      const memberConfig = getSessionTimeoutForRole("member");

      expect(managerConfig.idleTimeout).toBeLessThanOrEqual(
        memberConfig.idleTimeout
      );
      expect(managerConfig.absoluteTimeout).toBeLessThanOrEqual(
        memberConfig.absoluteTimeout
      );
    });

    it("should fallback to member config for unknown role", () => {
      const config = getSessionTimeoutForRole("unknown_role");
      expect(config.idleTimeout).toBe(1800000);
      expect(config.absoluteTimeout).toBe(3600000);
    });
  });
});
