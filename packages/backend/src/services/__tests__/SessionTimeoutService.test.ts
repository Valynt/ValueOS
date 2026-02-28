/**
 * Session Timeout Service Tests
 *
 * Tests for AUTH-004 role-based session timeouts
 */

import { beforeEach, describe, expect, it } from "vitest";

import { getSessionTimeoutForRole } from "../../security/SecurityConfig.js"
import { SessionTimeoutService } from "../SessionTimeoutService.js"

describe("SessionTimeoutService", () => {
  let service: SessionTimeoutService;

  beforeEach(() => {
    service = new SessionTimeoutService();
  });

  describe("Role-based timeout configuration", () => {
    it("should have shorter timeouts for super_admin", () => {
      const config = getSessionTimeoutForRole("super_admin");
      expect(config.idleTimeout).toBe(900000); // 15 minutes
      expect(config.absoluteTimeout).toBe(1800000); // 30 minutes
    });

    it("should have longer timeouts for member", () => {
      const config = getSessionTimeoutForRole("member");
      expect(config.idleTimeout).toBe(1800000); // 30 minutes
      expect(config.absoluteTimeout).toBe(3600000); // 1 hour
    });

    it("should have shortest timeouts for guest", () => {
      const config = getSessionTimeoutForRole("guest");
      expect(config.idleTimeout).toBe(600000); // 10 minutes
      expect(config.absoluteTimeout).toBe(1800000); // 30 minutes
    });

    it("should fallback to member config for unknown role", () => {
      const config = getSessionTimeoutForRole("unknown_role");
      expect(config.idleTimeout).toBe(1800000);
      expect(config.absoluteTimeout).toBe(3600000);
    });
  });

  describe("checkSession", () => {
    it("should mark session as valid within timeouts", () => {
      const session = {
        userId: "user-123",
        role: "member",
        createdAt: Date.now() - 60000, // 1 minute ago
        lastActivity: Date.now() - 30000, // 30 seconds ago
      };

      const status = service.checkSession(session);

      expect(status.valid).toBe(true);
      expect(status.reason).toBe("active");
    });

    it("should mark session as expired due to idle timeout", () => {
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: Date.now() - 600000, // 10 minutes ago
        lastActivity: Date.now() - 1000000, // 16+ minutes ago (admin idle: 15min)
      };

      const status = service.checkSession(session);

      expect(status.valid).toBe(false);
      expect(status.reason).toBe("idle_timeout");
    });

    it("should mark session as expired due to absolute timeout", () => {
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: Date.now() - 2000000, // 33+ minutes ago (admin absolute: 30min)
        lastActivity: Date.now() - 60000, // 1 minute ago (within idle limit)
      };

      const status = service.checkSession(session);

      expect(status.valid).toBe(false);
      expect(status.reason).toBe("absolute_timeout");
    });

    it("should trigger warning before expiry", () => {
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: Date.now() - 1680000, // 28 minutes ago (admin warning: 2min before 30min)
        lastActivity: Date.now() - 60000,
      };

      const status = service.checkSession(session);

      expect(status.valid).toBe(true);
      expect(status.shouldWarn).toBe(true);
    });

    it("should trigger auto-renewal before expiry", () => {
      const session = {
        userId: "user-123",
        role: "member",
        createdAt: Date.now() - 3400000, // 56+ minutes ago (member renewal: 5min before 1hr)
        lastActivity: Date.now() - 60000,
      };

      const status = service.checkSession(session);

      expect(status.valid).toBe(true);
      expect(status.shouldRenew).toBe(true);
    });
  });

  describe("updateActivity", () => {
    it("should update lastActivity timestamp", () => {
      const session = {
        userId: "user-123",
        role: "member",
        createdAt: Date.now() - 600000,
        lastActivity: Date.now() - 300000,
      };

      const updated = service.updateActivity(session);

      expect(updated.lastActivity).toBeGreaterThan(session.lastActivity);
      expect(updated.userId).toBe(session.userId);
    });
  });

  describe("renewSession", () => {
    it("should reset activity and set renewedAt", () => {
      const session = {
        userId: "user-123",
        role: "admin",
        createdAt: Date.now() - 1500000,
        lastActivity: Date.now() - 1200000,
      };

      const renewed = service.renewSession(session);

      expect(renewed.renewedAt).toBeDefined();
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
  });
});
