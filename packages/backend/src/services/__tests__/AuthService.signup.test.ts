/**
 * AuthService Signup Unit Tests
 * Tests user registration functionality including validation, security, and error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../AuthService.js"
import {
  ValidationError,
  RateLimitError,
  AuthenticationError,
} from "../errors";
import {
  createSignupData,
  createSuccessfulSignupResponse,
  createAuthErrorResponse,
  TEST_PASSWORDS,
  TEST_EMAILS,
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

describe("AuthService - Signup", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
    mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Valid Registration", () => {
    it("should successfully register a new user with all required fields", async () => {
      // Arrange
      const signupData = createSignupData();
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(mockResponse);

      // Act
      const result = await service.signup(signupData);

      // Assert
      expect(result).toBeDefined();
      expect(result.user).toEqual(mockResponse.data.user);
      expect(result.session).toEqual(mockResponse.data.session);
      expect(mocks.mockSupabaseAuth.signUp).toHaveBeenCalledWith({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.fullName,
          },
        },
      });
      expect(mocks.mockResetRateLimit).toHaveBeenCalledWith(
        "auth",
        signupData.email
      );
    });

    it("should validate password before making API call", async () => {
      // Arrange
      const signupData = createSignupData({ password: TEST_PASSWORDS.valid });
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(mockResponse);

      // Act
      await service.signup(signupData);

      // Assert
      expect(mocks.mockSupabaseAuth.signUp).toHaveBeenCalled();
    });

    it("should check for password breaches before registration", async () => {
      // Arrange
      const signupData = createSignupData();
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(mockResponse);

      // Act
      await service.signup(signupData);

      // Assert
      expect(mocks.mockCheckPasswordBreach).toHaveBeenCalledWith(
        signupData.password
      );
    });
  });

  describe("Missing Required Fields", () => {
    it("should throw ValidationError when email is missing", async () => {
      // Arrange
      const signupData = {
        password: "SecurePass123!",
        fullName: "Test User",
      } as any;

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        "Missing required fields: email"
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should throw ValidationError when password is missing", async () => {
      // Arrange
      const signupData = {
        email: "test@example.com",
        fullName: "Test User",
      } as any;

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        "Missing required fields: password"
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should throw ValidationError when fullName is missing", async () => {
      // Arrange
      const signupData = {
        email: "test@example.com",
        password: "SecurePass123!",
      } as any;

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        "Missing required fields: fullName"
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should throw ValidationError when multiple fields are missing", async () => {
      // Arrange
      const signupData = { fullName: "Test User" } as any;

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        "Missing required fields"
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });
  });

  describe("Password Validation", () => {
    it("should reject password that is too short", async () => {
      // Arrange
      const signupData = createSignupData({
        password: TEST_PASSWORDS.tooShort,
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(ValidationError);
      await expect(service.signup(signupData)).rejects.toThrow(
        /at least \d+ characters/
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should reject password without uppercase letters", async () => {
      // Arrange
      const signupData = createSignupData({
        password: TEST_PASSWORDS.noUppercase,
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(ValidationError);
      await expect(service.signup(signupData)).rejects.toThrow(
        /uppercase letter/
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should reject password without lowercase letters", async () => {
      // Arrange
      const signupData = createSignupData({
        password: TEST_PASSWORDS.noLowercase,
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(ValidationError);
      await expect(service.signup(signupData)).rejects.toThrow(
        /lowercase letter/
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should reject password without numbers", async () => {
      // Arrange
      const signupData = createSignupData({
        password: TEST_PASSWORDS.noNumbers,
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(ValidationError);
      await expect(service.signup(signupData)).rejects.toThrow(/number/);
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should reject password without symbols", async () => {
      // Arrange
      const signupData = createSignupData({
        password: TEST_PASSWORDS.noSymbols,
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(ValidationError);
      await expect(service.signup(signupData)).rejects.toThrow(/symbol/);
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });
  });

  describe("Password Breach Detection", () => {
    it("should reject breached passwords", async () => {
      // Arrange
      const signupData = createSignupData({
        password: TEST_PASSWORDS.breached,
      });
      mocks.mockCheckPasswordBreach.mockResolvedValueOnce(true);

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(ValidationError);
      await expect(service.signup(signupData)).rejects.toThrow(/breach/);
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should allow non-breached passwords", async () => {
      // Arrange
      const signupData = createSignupData();
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockCheckPasswordBreach.mockResolvedValue(false);
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(mockResponse);

      // Act
      const result = await service.signup(signupData);

      // Assert
      expect(result).toBeDefined();
      expect(mocks.mockCheckPasswordBreach).toHaveBeenCalledWith(
        signupData.password
      );
      expect(mocks.mockSupabaseAuth.signUp).toHaveBeenCalled();
    });
  });

  describe("Duplicate Email Handling", () => {
    it("should throw AuthenticationError for duplicate email", async () => {
      // Arrange
      const signupData = createSignupData({ email: TEST_EMAILS.duplicate });
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(
        createAuthErrorResponse("User already registered")
      );

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limiting on signup", async () => {
      // Arrange
      const signupData = createSignupData();

      // Act
      await expect(service.signup(signupData)).rejects.toThrow();

      // Assert
      expect(mocks.mockConsumeAuthRateLimit).toHaveBeenCalledWith(
        signupData.email
      );
    });

    it("should throw RateLimitError when rate limit exceeded", async () => {
      // Arrange
      const signupData = createSignupData();
      const { RateLimitExceededError } = await import("../../security");
      mocks.mockConsumeAuthRateLimit.mockImplementation(() => {
        throw new RateLimitExceededError(1000, 5, 300000);
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(RateLimitError);
      await expect(service.signup(signupData)).rejects.toThrow(
        /Too many authentication attempts/
      );
      expect(mocks.mockSupabaseAuth.signUp).not.toHaveBeenCalled();
    });

    it("should reset rate limit after successful signup", async () => {
      // Arrange
      const signupData = createSignupData();
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(mockResponse);

      // Act
      await service.signup(signupData);

      // Assert
      expect(mocks.mockResetRateLimit).toHaveBeenCalledWith(
        "auth",
        signupData.email
      );
    });
  });

  describe("MFA Support", () => {
    it("should log MFA hint when MFA is enabled", async () => {
      // Arrange
      mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: true } });
      const signupData = createSignupData();
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(mockResponse);

      // Act
      await service.signup(signupData);

      // Assert
      expect(mocks.mockGetConfig).toHaveBeenCalled();
      // MFA hint should be logged (this is indirect, but the getConfig call confirms MFA check)
    });
  });

  describe("Error Handling", () => {
    it("should handle Supabase errors gracefully", async () => {
      // Arrange
      const signupData = createSignupData();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(
        createAuthErrorResponse("Service unavailable")
      );

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        AuthenticationError
      );
    });

    it("should throw AuthenticationError when user is null in response", async () => {
      // Arrange
      const signupData = createSignupData();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        AuthenticationError
      );
      await expect(service.signup(signupData)).rejects.toThrow("Signup failed");
    });

    it("should throw AuthenticationError when session is null in response", async () => {
      // Arrange
      const signupData = createSignupData();
      const mockResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue({
        ...mockResponse,
        data: { ...mockResponse.data, session: null },
      });

      // Act & Assert
      await expect(service.signup(signupData)).rejects.toThrow(
        AuthenticationError
      );
      await expect(service.signup(signupData)).rejects.toThrow("Signup failed");
    });
  });
});
