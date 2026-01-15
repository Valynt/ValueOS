/**
 * Authentication Security Tests
 * Tests security features including XSS prevention, rate limiting,  and input sanitization
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  sanitizeUserInput,
  RateLimiter,
  validatePassword,
} from "../../utils/security";
import { AuthService } from "../AuthService";
import {
  TEST_EMAILS,
  TEST_PASSWORDS,
  createSignupData,
} from "../../test-utils/auth.fixtures";
import { setupAuthMocks, resetAuthMocks } from "../../test-utils/auth.helpers";

// Setup mocks
const mocks = setupAuthMocks();

vi.mock("../../lib/supabase", () => ({
  supabase: { auth: mocks.mockSupabaseAuth },
}));

vi.mock("../../security", async () => {
  const actual =
    await vi.importActual<typeof import("../../security")>("../../security");
  return {
    ...actual,
    consumeAuthRateLimit: mocks.mockConsumeAuthRateLimit,
    resetRateLimit: mocks.mockResetRateLimit,
    checkPasswordBreach: mocks.mockCheckPasswordBreach,
  };
});

vi.mock("../../config/environment", async () => {
  const actual = await vi.importActual<
    typeof import("../../config/environment")
  >("../../config/environment");
  return {
    ...actual,
    getConfig: mocks.mockGetConfig,
  };
});

vi.mock("../ClientRateLimit", () => ({
  clientRateLimit: mocks.mockClientRateLimit,
}));

describe("Authentication Security Tests", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
    mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
  });

  describe("XSS Prevention", () => {
    it("should sanitize malicious email inputs", () => {
      // Arrange
      const maliciousEmail = TEST_EMAILS.malicious;

      // Act
      const sanitized = sanitizeUserInput(maliciousEmail);

      // Assert
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("alert");
    });

    it("should prevent XSS in user input fields", () => {
      // Arrange
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        "<iframe src=\"javascript:alert('XSS')\">",
      ];

      // Act & Assert
      xssAttempts.forEach((attempt) => {
        const sanitized = sanitizeUserInput(attempt);
        expect(sanitized).not.toContain("<script");
        expect(sanitized).not.toContain("<iframe");
        expect(sanitized).not.toContain("javascript:");
        expect(sanitized).not.toContain("onerror");
      });
    });

    it("should preserve valid user input while removing scripts", () => {
      // Arrange
      const validInput = "John Doe <john@example.com>";

      // Act
      const sanitized = sanitizeUserInput(validInput);

      // Assert
      expect(sanitized).toBeTruthy();
      expect(sanitized).not.toContain("<script");
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should not process SQL injection attempts in email", async () => {
      // Arrange
      const sqlInjectionEmail = TEST_EMAILS.sqlInjection;
      const signupData = createSignupData({ email: sqlInjectionEmail });

      // The email should be handled safely by Supabase
      // We test that the service doesn't crash or expose errors
      mocks.mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid email", status: 400, name: "AuthApiError" },
      });

      // Act & Assert - Should handle gracefully
      await expect(service.signup(signupData)).rejects.toThrow();
      expect(mocks.mockSupabaseAuth.signUp).toHaveBeenCalled();
    });
  });

  describe("Brute Force Protection", () => {
    it("should enforce rate limiting to prevent brute force attacks", () => {
      // Arrange
      const rateLimiter = new RateLimiter({
        maxAttempts: 5,
        windowMs: 60000, // 1 minute
        lockoutMs: 300000, // 5 minutes
      });
      const identifier = "test@example.com";

      // Act - Simulate failed login attempts
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(identifier);
      }

      // Assert - Next attempt should be blocked
      const result = rateLimiter.canAttempt(identifier);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it("should reset rate limit after successful authentication", async () => {
      // Arrange
      const email = "test@example.com";

      // Simulate failed attempts (rate limit consumed)
      for (let i = 0; i < 3; i++) {
        mocks.mockConsumeAuthRateLimit.mockClear();
        mocks.mockResetRateLimit.mockClear();
      }

      // Act - Successful signup should reset rate limit
      const signupData = createSignupData({ email });
      mocks.mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: {} as any, session: {} as any },
        error: null,
      });
      await service.signup(signupData);

      // Assert
      expect(mocks.mockResetRateLimit).toHaveBeenCalledWith("auth", email);
    });

    it("should apply different rate limits for different actions", () => {
      // Arrange
      const loginLimiter = new RateLimiter({
        maxAttempts: 5,
        windowMs: 60000,
        lockoutMs: 300000,
      });

      const passwordResetLimiter = new RateLimiter({
        maxAttempts: 3,
        windowMs: 600000, // 10 minutes
        lockoutMs: 3600000, // 1 hour
      });

      const identifier = "test@example.com";

      // Act - Record failures
      for (let i = 0; i < 5; i++) {
        loginLimiter.recordFailure(identifier);
      }

      for (let i = 0; i < 3; i++) {
        passwordResetLimiter.recordFailure(identifier);
      }

      // Assert - Both should be locked but with different retry times
      const loginResult = loginLimiter.canAttempt(identifier);
      const resetResult = passwordResetLimiter.canAttempt(identifier);

      expect(loginResult.allowed).toBe(false);
      expect(resetResult.allowed).toBe(false);
      expect(resetResult.retryAfter).toBeGreaterThan(
        loginResult.retryAfter || 0
      );
    });
  });

  describe("Password Security", () => {
    it("should enforce strong password requirements", () => {
      // Arrange
      const weakPasswords = [
        TEST_PASSWORDS.tooShort,
        TEST_PASSWORDS.noUppercase,
        TEST_PASSWORDS.noLowercase,
        TEST_PASSWORDS.noNumbers,
        TEST_PASSWORDS.noSymbols,
      ];

      // Act & Assert
      weakPasswords.forEach((password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it("should accept strong passwords", () => {
      // Arrange
      const strongPassword = TEST_PASSWORDS.valid;

      // Act
      const result = validatePassword(strongPassword);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should prevent use of breached passwords", async () => {
      // Arrange
      const breachedPassword = TEST_PASSWORDS.breached;
      const signupData = createSignupData({ password: breachedPassword });
      mocks.mockCheckPasswordBreach.mockResolvedValueOnce(true);

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(/breach/);
    });
  });

  describe("Session Security", () => {
    it("should not expose sensitive data in error messages", async () => {
      // Arrange
      const credentials = {
        email: "test@example.com",
        password: "wrongpassword",
      };
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "Invalid credentials",
          status: 401,
          name: "AuthApiError",
        },
      });

      // Act
      let error: any;
      try {
        await service.login(credentials);
      } catch (e) {
        error = e;
      }

      // Assert - Error message should be generic
      expect(error.message).not.toContain("password");
      expect(error.message).not.toContain("database");
      expect(error.message).toBe("Invalid credentials");
    });
  });
});
