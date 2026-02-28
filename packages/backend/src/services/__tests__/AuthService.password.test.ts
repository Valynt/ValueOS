/**
 * AuthService Password Management Unit Tests
 * Tests password reset and update functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_PASSWORDS } from "../../test-utils/auth.fixtures";
import { resetAuthMocks, setupAuthMocks } from "../../test-utils/auth.helpers";
import { AuthService } from "../AuthService.js"
import {
  AuthenticationError,
  RateLimitError,
  ValidationError,
} from "../errors";

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

describe("AuthService - Password Management", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
    mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Request Password Reset", () => {
    it("should successfully request password reset", async () => {
      //Arrange
      const email = "user@example.com";
      mocks.mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      // Act
      await service.requestPasswordReset(email);

      // Assert
      expect(mocks.mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        email
      );
      expect(mocks.mockResetRateLimit).toHaveBeenCalledWith("auth", email);
    });

    it("should enforce rate limiting on password reset", async () => {
      // Arrange
      const email = "user@example.com";
      mocks.mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      // Act
      await service.requestPasswordReset(email);

      // Assert
      expect(mocks.mockConsumeAuthRateLimit).toHaveBeenCalledWith(email);
    });

    it("should throw RateLimitError when rate limit exceeded", async () => {
      // Arrange
      const email = "user@example.com";
      const { RateLimitExceededError } = await import("../../security");
      mocks.mockConsumeAuthRateLimit.mockImplementation(() => {
        throw new RateLimitExceededError(1000, 5, 300000);
      });

      // Act & Assert
      await expect(service.requestPasswordReset(email)).rejects.toThrow(
        RateLimitError
      );
      expect(
        mocks.mockSupabaseAuth.resetPasswordForEmail
      ).not.toHaveBeenCalled();
    });

    it("should throw AuthenticationError on Supabase error", async () => {
      // Arrange
      const email = "user@example.com";
      mocks.mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        error: {
          message: "Email not found",
          status: 404,
          name: "AuthApiError",
        },
      });

      // Act & Assert
      await expect(service.requestPasswordReset(email)).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe("Update Password", () => {
    it("should successfully update password with valid new password", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.valid;
      mocks.mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: {} as any },
        error: null,
      });

      // Act
      await service.updatePassword(newPassword);

      // Assert
      expect(mocks.mockSupabaseAuth.updateUser).toHaveBeenCalledWith({
        password: newPassword,
      });
    });

    it("should reject password that is too short", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.tooShort;

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        ValidationError
      );
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        /at least \d+ characters/
      );
      expect(mocks.mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it("should reject password without uppercase letters", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.noUppercase;

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        ValidationError
      );
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        /uppercase letter/
      );
      expect(mocks.mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it("should reject password without lowercase letters", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.noLowercase;

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        ValidationError
      );
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        /lowercase letter/
      );
      expect(mocks.mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it("should reject password without numbers", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.noNumbers;

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        ValidationError
      );
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        /number/
      );
      expect(mocks.mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it("should reject password without symbols", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.noSymbols;

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        ValidationError
      );
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        /symbol/
      );
      expect(mocks.mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it("should reject breached passwords", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.breached;
      mocks.mockCheckPasswordBreach.mockResolvedValueOnce(true);

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        ValidationError
      );
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        /breach/
      );
      expect(mocks.mockSupabaseAuth.updateUser).not.toHaveBeenCalled();
    });

    it("should check for password breaches before update", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.valid;
      mocks.mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: {} as any },
        error: null,
      });

      // Act
      await service.updatePassword(newPassword);

      // Assert
      expect(mocks.mockCheckPasswordBreach).toHaveBeenCalledWith(newPassword);
    });

    it("should throw AuthenticationError on Supabase error", async () => {
      // Arrange
      const newPassword = TEST_PASSWORDS.valid;
      mocks.mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Update failed", status: 500, name: "AuthApiError" },
      });

      // Act & Assert
      await expect(service.updatePassword(newPassword)).rejects.toThrow(
        AuthenticationError
      );
    });
  });
});
