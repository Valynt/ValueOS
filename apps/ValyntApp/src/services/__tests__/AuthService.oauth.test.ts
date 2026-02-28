/**
 * AuthService OAuth Unit Tests
 * Tests OAuth authentication flow for Google, Apple, and GitHub
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OAUTH_PROVIDERS } from "../../test-utils/auth.fixtures";
import {
  resetAuthMocks,
  setupAuthMocks,
  setupBrowserMocks,
} from "../../test-utils/auth.helpers";
import { AuthService } from "../AuthService";
import { AuthenticationError } from "../errors";

// Setup mocks
const mocks = setupAuthMocks();
const browserMocks = setupBrowserMocks();

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

describe("AuthService - OAuth", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("OAuth Initiation", () => {
    it("should initiate Google OAuth sign-in", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "google", url: "https://accounts.google.com/oauth" },
        error: null,
      });

      // Act
      await service.signInWithProvider(OAUTH_PROVIDERS.google);

      // Assert
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:5173/auth/callback",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
    });

    it("should initiate Apple OAuth sign-in", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "apple", url: "https://appleid.apple.com/auth" },
        error: null,
      });

      // Act
      await service.signInWithProvider(OAUTH_PROVIDERS.apple);

      // Assert
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: {
          redirectTo: "http://localhost:5173/auth/callback",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
    });

    it("should initiate GitHub OAuth sign-in", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "github", url: "https://github.com/login/oauth" },
        error: null,
      });

      // Act
      await service.signInWithProvider(OAUTH_PROVIDERS.github);

      // Assert
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: "http://localhost:5173/auth/callback",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
    });

    it("should use current origin for redirect URL", async () => {
      // Arrange
      browserMocks.localStorage.clear();
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "google", url: "https://accounts.google.com/oauth" },
        error: null,
      });

      // Act
      await service.signInWithProvider(OAUTH_PROVIDERS.google);

      // Assert
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo: expect.stringContaining("/auth/callback"),
          }),
        })
      );
    });
  });

  describe("OAuth Error Handling", () => {
    it("should throw AuthenticationError on OAuth failure", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: null, url: null },
        error: {
          message: "OAuth provider not configured",
          status: 400,
          name: "AuthApiError",
        },
      });

      // Act & Assert
      await expect(
        service.signInWithProvider(OAUTH_PROVIDERS.google)
      ).rejects.toThrow(AuthenticationError);
      await expect(
        service.signInWithProvider(OAUTH_PROVIDERS.google)
      ).rejects.toThrow(/OAuth sign in failed/);
    });

    it("should sanitize error messages from OAuth provider", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: null, url: null },
        error: {
          message: "Detailed OAuth error with sensitive info",
          status: 500,
          name: "AuthApiError",
        },
      });

      // Act & Assert
      await expect(
        service.signInWithProvider(OAUTH_PROVIDERS.google)
      ).rejects.toThrow(AuthenticationError);
    });

    it("should handle network errors during OAuth initiation", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockRejectedValue(
        new Error("Network request failed")
      );

      // Act & Assert
      await expect(
        service.signInWithProvider(OAUTH_PROVIDERS.google)
      ).rejects.toThrow();
    });
  });

  describe("OAuth Redirect Configuration", () => {
    it("should configure correct redirect URL for all providers", async () => {
      // Arrange
      const providers = [
        OAUTH_PROVIDERS.google,
        OAUTH_PROVIDERS.apple,
        OAUTH_PROVIDERS.github,
      ];
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "test", url: "https://test.com" },
        error: null,
      });

      // Act
      for (const provider of providers) {
        await service.signInWithProvider(provider);
      }

      // Assert
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledTimes(3);
      mocks.mockSupabaseAuth.signInWithOAuth.mock.calls.forEach((call) => {
        expect(call[0].options?.redirectTo).toMatch(/\/auth\/callback$/);
      });
    });

    it("should include offline access and consent prompt", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "google", url: "https://accounts.google.com/oauth" },
        error: null,
      });

      // Act
      await service.signInWithProvider(OAUTH_PROVIDERS.google);

      // Assert
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          }),
        })
      );
    });
  });
});
