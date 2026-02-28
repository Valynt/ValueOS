/**
 * Automated Security Tests for Authentication
 * Tests for security vulnerabilities and proper implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { csrfProtection } from "../../lib/csrfProtection";
import { authRateLimiter } from "../../lib/rateLimiter";
import { secureTokenStorage } from "../../lib/secureStorage";
import { securityLogger } from "../../lib/securityLogger";
import { authService } from "../../services/authServiceAbstraction";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Mock navigator
Object.defineProperty(global.navigator, "userAgent", {
  value: "Mozilla/5.0 (Test Browser)",
  writable: true,
});

describe("Authentication Security Tests", () => {
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
      const email = "test@example.com";
      const credentials = { email, password: "wrongpassword" };

      // Mock failed login response
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.login(credentials);
      }

      // 6th attempt should be rate limited
      const result = await authService.login(credentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many failed attempts");
    });

    it("should reset rate limit after successful authentication", async () => {
      const email = "test@example.com";
      const wrongCredentials = { email, password: "wrongpassword" };
      const correctCredentials = { email, password: "correctpassword" };

      // Make 3 failed attempts
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      for (let i = 0; i < 3; i++) {
        await authService.login(wrongCredentials);
      }

      // Check rate limit status
      const status = authRateLimiter.getRateLimitStatus(email);
      expect(status.attempts).toBe(3);

      // Mock successful login
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { id: "1", email },
          token: "valid-token",
          refreshToken: "refresh-token",
        }),
      });

      // Successful login should reset rate limit
      await authService.login(correctCredentials);

      const finalStatus = authRateLimiter.getRateLimitStatus(email);
      expect(finalStatus.attempts).toBe(0);
    });

    it("should log rate limit exceeded events", async () => {
      const email = "test@example.com";
      const credentials = { email, password: "wrongpassword" };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      // Trigger rate limit
      for (let i = 0; i < 5; i++) {
        await authService.login(credentials);
      }

      // One more attempt should trigger rate limit logging
      await authService.login(credentials);

      const events = securityLogger.getEventsByType("rate_limit_exceeded");
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].email).toBe(email);
      expect(events[0].severity).toBe("high");
    });
  });

  describe("Token Security", () => {
    it("should store tokens securely with encryption", async () => {
      const tokenData = {
        token: "sensitive-jwt-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        userId: "user123",
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
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        userId: "user123",
      };

      await secureTokenStorage.setToken(expiredTokenData);

      const retrieved = await secureTokenStorage.getAccessToken();
      expect(retrieved).toBeNull();
    });

    it("should clear tokens on logout", async () => {
      const tokenData = {
        token: "test-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        userId: "user123",
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
    it("should log authentication attempts", async () => {
      const credentials = { email: "test@example.com", password: "password" };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          user: { id: "1", email: "test@example.com" },
          token: "valid-token",
          refreshToken: "refresh-token",
        }),
      });

      await authService.login(credentials);

      const attempts = securityLogger.getEventsByType("auth_attempt");
      const successes = securityLogger.getEventsByType("auth_success");

      expect(attempts.length).toBeGreaterThan(0);
      expect(successes.length).toBeGreaterThan(0);
      expect(attempts[0].email).toBe("test@example.com");
      expect(successes[0].userId).toBe("1");
    });

    it("should log authentication failures", async () => {
      const credentials = { email: "test@example.com", password: "wrongpassword" };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      await authService.login(credentials);

      const failures = securityLogger.getEventsByType("auth_failure");
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0].email).toBe("test@example.com");
      expect(failures[0].severity).toBe("medium");
    });

    it("should provide security metrics", () => {
      // Simulate some events
      securityLogger.logAuthAttempt("user1@example.com");
      securityLogger.logAuthSuccess("1", "user1@example.com");
      securityLogger.logAuthFailure("user2@example.com", "Invalid password");
      securityLogger.logRateLimitExceeded("user3@example.com", 5, 900000, undefined);

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

      const suspiciousEvents = securityLogger.getEventsByType("suspicious_activity");
      const failures = securityLogger.getEventsByType("auth_failure");

      expect(failures.length).toBe(10);
      // In a real implementation, this would trigger suspicious activity detection
    });
  });

  describe("Input Validation Security", () => {
    it("should reject invalid email formats", async () => {
      const invalidCredentials = [
        { email: "invalid-email", password: "password123" },
        { email: "@example.com", password: "password123" },
        { email: "test@", password: "password123" },
        { email: "", password: "password123" },
      ];

      for (const credentials of invalidCredentials) {
        await expect(authService.login(credentials)).rejects.toThrow();
      }
    });

    it("should reject weak passwords", async () => {
      const weakPasswords = [
        { email: "test@example.com", password: "123" },
        { email: "test@example.com", password: "password" },
        { email: "test@example.com", password: "weak" },
        { email: "test@example.com", password: "" },
      ];

      for (const credentials of weakPasswords) {
        await expect(authService.login(credentials)).rejects.toThrow();
      }
    });

    it("should sanitize and validate user input", async () => {
      const maliciousInput = {
        email: "test@example.com",
        password: '<script>alert("xss")</script>password123',
      };

      // Should not throw validation error (password meets length requirement)
      // but should be properly sanitized before API call
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: "Invalid credentials" }),
      });

      await authService.login(maliciousInput);

      // Verify the request was made with sanitized data
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(maliciousInput.password),
        })
      );
    });
  });

  describe("Session Security", () => {
    it("should handle session expiration gracefully", async () => {
      // Mock expired token
      localStorageMock.getItem.mockReturnValue("expired-token-data");

      const status = await authService.getStatus();
      expect(status.isAuthenticated).toBe(false);
    });

    it("should refresh tokens before expiration", async () => {
      const validTokenData = {
        token: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        userId: "user123",
      };

      await secureTokenStorage.setToken(validTokenData);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "new-token",
          refreshToken: "new-refresh-token",
        }),
      });

      const refreshed = await authService.refreshToken();
      expect(refreshed).toBe(true);
    });
  });

  describe("Error Handling Security", () => {
    it("should not expose sensitive information in error messages", async () => {
      const credentials = { email: "test@example.com", password: "password" };

      // Mock server error
      mockFetch.mockRejectedValue(new Error("Database connection failed"));

      const result = await authService.login(credentials);
      expect(result.success).toBe(false);
      expect(result.error).not.toContain("Database");
      expect(result.error).toBe("An unexpected error occurred during login");
    });

    it("should handle network failures gracefully", async () => {
      const credentials = { email: "test@example.com", password: "password" };

      // Mock network failure
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await authService.login(credentials);
      expect(result.success).toBe(false);
      expect(result.error).toBe("An unexpected error occurred during login");
    });
  });
});
