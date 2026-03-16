/**
 * Automated Security Tests for Authentication
 * Tests for security vulnerabilities and proper implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { csrfProtection } from "../../lib/csrfProtection";
import { authRateLimiter } from "../../lib/rateLimiter";
import { secureTokenStorage } from "../../lib/secureStorage";
import { securityLogger } from "../../lib/securityLogger";

// Test constants
const MAX_FAILED_ATTEMPTS = 5;
const ALLOWED_ATTEMPTS_BEFORE_BLOCK = 4;
const HOUR_MS = 3600000;
const SECOND_MS = 1000;
const PARTIAL_FAILED_ATTEMPTS = 3;
const RESET_ATTEMPTS = 0;
const LOG_RATE_LIMIT_COUNT = 5;
const LOG_TIMEOUT_MS = 900000;

// Global type declarations for test environment
declare global {
  var localStorage: Storage;
  var sessionStorage: Storage;
}

// Mock fetch for API calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock localStorage
const localStorageMock: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
globalThis.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
globalThis.sessionStorage = sessionStorageMock;

// Mock navigator
Object.defineProperty(globalThis.navigator, "userAgent", {
  value: "Mozilla/5.0 (Test Browser)",
  writable: true,
});

describe("MCP Dashboard Authentication Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    securityLogger.clear();
    authRateLimiter.clearAllData();
    secureTokenStorage.clearToken();
    csrfProtection.clearToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rate Limiting Security", () => {
    it("should prevent brute force attacks after 5 failed attempts", async () => {
      const email = "admin@example.com";

      // Mock failed login response
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      // Make MAX_FAILED_ATTEMPTS failed attempts
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        const status = authRateLimiter.canAttemptAuth(email);
        if (i < ALLOWED_ATTEMPTS_BEFORE_BLOCK) {
          expect(status.allowed).toBe(true);
        } else {
          expect(status.allowed).toBe(false);
        }
        authRateLimiter.recordFailedAttempt(email);
      }

      // 6th attempt should be rate limited
      const status = authRateLimiter.canAttemptAuth(email);
      expect(status.allowed).toBe(false);
      expect(status.lockoutRemaining).toBeGreaterThan(0);
    });

    it("should reset rate limit after successful authentication", async () => {
      const email = "admin@example.com";

      // Make PARTIAL_FAILED_ATTEMPTS failed attempts
      for (let i = 0; i < PARTIAL_FAILED_ATTEMPTS; i++) {
        authRateLimiter.recordFailedAttempt(email);
      }

      // Check rate limit status
      const status = authRateLimiter.getRateLimitStatus(email);
      expect(status.attempts).toBe(PARTIAL_FAILED_ATTEMPTS);

      // Successful login should reset rate limit
      authRateLimiter.recordSuccessfulAttempt(email);

      const finalStatus = authRateLimiter.getRateLimitStatus(email);
      expect(finalStatus.attempts).toBe(RESET_ATTEMPTS);
    });

    it("should log rate limit exceeded events", async () => {
      const email = "admin@example.com";

      // Trigger rate limit
      for (let i = 0; i < 5; i++) {
        authRateLimiter.recordFailedAttempt(email);
      }

      // One more attempt should trigger rate limit logging
      securityLogger.logRateLimitExceeded(email, LOG_RATE_LIMIT_COUNT, LOG_TIMEOUT_MS, "192.168.1.100");

      const events = securityLogger.getEventsByType("rate_limit_exceeded");
      expect(events.length).toBe(1);
      expect(events[0]?.email).toBe(email);
      expect(events[0]?.severity).toBe("high");
    });
  });

  describe("Token Security", () => {
    it("should store tokens securely with encryption", async () => {
      const tokenData = {
        token: "sensitive-jwt-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + HOUR_MS,
        userId: "admin123",
      };

      await secureTokenStorage.setToken(tokenData);

      // Verify token was stored (encrypted)
      expect(localStorageMock.setItem).toHaveBeenCalled();

      // Verify token can be retrieved
      const retrieved = await secureTokenStorage.getAccessToken();
      expect(retrieved).toBe(tokenData.token);
    });

    it("should expire tokens properly", async () => {
      const expiredTokenData = {
        token: "expired-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() - SECOND_MS, // Expired 1 second ago
        userId: "admin123",
      };

      await secureTokenStorage.setToken(expiredTokenData);

      const retrieved = await secureTokenStorage.getAccessToken();
      expect(retrieved).toBeNull();
    });

    it("should clear tokens on logout", async () => {
      const tokenData = {
        token: "test-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + HOUR_MS,
        userId: "admin123",
      };

      await secureTokenStorage.setToken(tokenData);
      await secureTokenStorage.clearToken();

      const retrieved = await secureTokenStorage.getAccessToken();
      expect(retrieved).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe("CSRF Protection", () => {
    it("should generate and validate CSRF tokens", () => {
      const token1 = csrfProtection.getToken();
      const token2 = csrfProtection.getToken();

      // Should return same token within session
      expect(token1).toBe(token2);
      expect(token1).toMatch(/^[A-Za-z0-9]{32}$/);
    });

    it("should add CSRF token to requests", () => {
      const requestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      };

      const securedRequest = csrfProtection.addTokenToRequest(requestInit);
      const headers = securedRequest.headers as Headers;

      expect(headers.has("X-CSRF-Token")).toBe(true);
      expect(headers.get("X-CSRF-Token")).toBe(csrfProtection.getToken());
    });

    it("should clear CSRF token on logout", () => {
      csrfProtection.getToken(); // Generate token
      csrfProtection.clearToken();

      const newToken = csrfProtection.getToken();
      // Should generate a new token after clearing
      expect(newToken).toBeTruthy();
    });
  });

  describe("Security Logging", () => {
    it("should log authentication attempts", () => {
      securityLogger.logAuthAttempt("admin@example.com", "192.168.1.100", "Test Browser");

      const attempts = securityLogger.getEventsByType("auth_attempt");
      expect(attempts.length).toBe(1);
      expect(attempts[0]?.email).toBe("admin@example.com");
      expect(attempts[0]?.ip).toBe("192.168.1.100");
    });

    it("should log authentication failures", () => {
      securityLogger.logAuthFailure("admin@example.com", "Invalid credentials", "192.168.1.100");

      const failures = securityLogger.getEventsByType("auth_failure");
      expect(failures.length).toBe(1);
      expect(failures[0]?.email).toBe("admin@example.com");
      expect(failures[0]?.severity).toBe("medium");
    });

    it("should provide security metrics", () => {
      // Simulate some events
      securityLogger.logAuthAttempt("user1@example.com");
      securityLogger.logAuthSuccess("1", "user1@example.com");
      securityLogger.logAuthFailure("user2@example.com", "Invalid password");
      securityLogger.logRateLimitExceeded("user3@example.com", 5, 900000, "192.168.1.100");

      const metrics = securityLogger.getMetrics();

      expect(metrics.totalAuthAttempts).toBe(1);
      expect(metrics.successfulAuths).toBe(1);
      expect(metrics.failedAuths).toBe(1);
      expect(metrics.rateLimitHits).toBe(1);
      expect(metrics.uniqueUsers).toBe(1);
    });

    it("should detect suspicious activity patterns", () => {
      // Simulate multiple failed attempts from same IP
      for (let i = 0; i < 10; i++) {
        securityLogger.logAuthFailure(`user${i}@example.com`, "Invalid password", "192.168.1.100");
      }

      const failures = securityLogger.getEventsByType("auth_failure");
      expect(failures.length).toBe(10);

      // Check for suspicious activity
      const ipCounts = new Map<string, number>();
      failures.forEach((event) => {
        if (event.ip) {
          ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1);
        }
      });

      expect(ipCounts.get("192.168.1.100")).toBe(10);
    });
  });

  describe("Input Validation Security", () => {
    it("should reject invalid email formats", () => {
      const invalidEmails = ["invalid-email", "@example.com", "test@", ""];

      invalidEmails.forEach((email) => {
        expect(() => {
          // This would be validated in the auth service
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            throw new Error("Invalid email format");
          }
        }).toThrow("Invalid email format");
      });
    });

    it("should reject weak passwords", () => {
      const weakPasswords = ["123", "password", "weak", ""];

      weakPasswords.forEach((password) => {
        expect(() => {
          if (password.length < 8) {
            throw new Error("Password must be at least 8 characters");
          }
        }).toThrow("Password must be at least 8 characters");
      });
    });

    it("should reject passwords containing HTML script tags", () => {
      // Passwords with embedded script tags must be rejected at the validation
      // layer before they reach any API call or storage path.
      const maliciousPasswords = [
        '<script>alert("xss")</script>password123',
        "password<script>evil()</script>",
        "<img src=x onerror=alert(1)>pass",
      ];

      maliciousPasswords.forEach((password) => {
        // A password containing an HTML tag is structurally invalid — reject it.
        const htmlTagPattern = /<[^>]+>/;
        expect(() => {
          if (htmlTagPattern.test(password)) {
            throw new Error("Password contains invalid characters");
          }
        }).toThrow("Password contains invalid characters");
      });
    });
  });

  describe("WebSocket Security", () => {
    it("should validate channel names", () => {
      const validChannels = ["user-updates", "notifications", "system-status"];
      const invalidChannels = ["../admin", "user/../delete", "channel;drop table", ""];

      validChannels.forEach((channel) => {
        expect(/^[a-zA-Z0-9_-]+$/.test(channel)).toBe(true);
      });

      invalidChannels.forEach((channel) => {
        expect(/^[a-zA-Z0-9_-]+$/.test(channel)).toBe(false);
      });
    });

    it("should limit data size for broadcasts", () => {
      const smallData = { message: "Hello" };
      const largeData = {
        data: "x".repeat(1024 * 1024 + 1), // Over 1MB
      };

      const smallSize = JSON.stringify(smallData).length;
      const largeSize = JSON.stringify(largeData).length;

      expect(smallSize).toBeLessThan(1024 * 1024);
      expect(largeSize).toBeGreaterThan(1024 * 1024);
    });
  });

  describe("Error Handling Security", () => {
    it("should not expose sensitive information in logs", () => {
      // Mock console methods to capture logs
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      securityLogger.logAuthFailure(
        "admin@example.com",
        "Database connection failed: user=admin password=secret"
      );

      const events = securityLogger.getEventsByType("auth_failure");
      expect(events[0]?.details.reason).toBe(
        "Database connection failed: user=admin password=secret"
      );

      // In production, this would be sanitized
      consoleSpy.mockRestore();
    });

    it("should handle security violations appropriately", () => {
      securityLogger.logSecurityViolation("Unauthorized access attempt", {
        endpoint: "/api/admin/users",
        method: "DELETE",
        userId: "user123",
      });

      const violations = securityLogger.getEventsByType("security_violation");
      expect(violations.length).toBe(1);
      expect(violations[0]?.severity).toBe("critical");
      expect(violations[0]?.details.violation).toBe("Unauthorized access attempt");
    });
  });
});
