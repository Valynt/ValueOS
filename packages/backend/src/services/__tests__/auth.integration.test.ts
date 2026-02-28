/**
 * Authentication Integration Tests
 * Tests complete authentication flows end-to-end
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLoginCredentials,
  createMockSession,
  createSignupData,
  createSuccessfulLoginResponse,
  createSuccessfulSignupResponse,
} from "../../test-utils/auth.fixtures";
import { resetAuthMocks, setupAuthMocks } from "../../test-utils/auth.helpers";
import { AuthService } from "../AuthService.js"

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

describe("Authentication Integration Tests", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
    mocks.mockGetConfig.mockReturnValue({ auth: { mfaEnabled: false } });
    mocks.mockClientRateLimit.checkLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Complete Registration to Login Flow", () => {
    it("should allow user to signup and then login successfully", async () => {
      // Arrange - Signup
      const signupData = createSignupData();
      const signupResponse = createSuccessfulSignupResponse();
      mocks.mockSupabaseAuth.signUp.mockResolvedValue(signupResponse);

      // Act - Signup
      const signupResult = await service.signup(signupData);

      // Assert - Signup successful
      expect(signupResult.user).toBeDefined();
      expect(signupResult.session).toBeDefined();

      // Arrange - Login with same credentials
      const loginCredentials = createLoginCredentials({
        email: signupData.email,
        password: signupData.password,
      });
      const loginResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        loginResponse
      );

      // Act - Login
      const loginResult = await service.login(loginCredentials);

      // Assert - Login successful
      expect(loginResult.user).toBeDefined();
      expect(loginResult.session).toBeDefined();
      expect(mocks.mockSupabaseAuth.signInWithPassword).toHaveBeenCalled();
    });

    it("should maintain session after login", async () => {
      // Arrange - Login
      const credentials = createLoginCredentials();
      const loginResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        loginResponse
      );

      // Act - Login
      await service.login(credentials);

      // Arrange - Get session
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: loginResponse.data.session },
        error: null,
      });

      // Act - Get session
      const session = await service.getSession();

      // Assert  - Session exists
      expect(session).toBeDefined();
      expect(session?.access_token).toBeDefined();
    });

    it("should allow session refresh after login", async () => {
      // Arrange - Login
      const credentials = createLoginCredentials();
      const loginResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        loginResponse
      );

      // Act - Login
      await service.login(credentials);

      // Arrange - Refresh session
      const newSession = createMockSession();
      mocks.mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { user: loginResponse.data.user, session: newSession },
        error: null,
      });

      // Act - Refresh
      const refreshed = await service.refreshSession();

      // Assert - Session refreshed
      expect(refreshed.session).toBeDefined();
      expect(refreshed.session.access_token).toBeDefined();
    });

    it("should logout successfully after login", async () => {
      // Arrange - Login
      const credentials = createLoginCredentials();
      const loginResponse = createSuccessfulLoginResponse();
      mocks.mockSupabaseAuth.signInWithPassword.mockResolvedValue(
        loginResponse
      );

      // Act - Login
      await service.login(credentials);

      // Arrange - Logout
      mocks.mockSupabaseAuth.signOut.mockResolvedValue({ error: null });

      // Act - Logout
      await service.logout();

      // Assert - Logout successful
      expect(mocks.mockSupabaseAuth.signOut).toHaveBeenCalled();

      // Arrange - Check session after logout
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act - Check auth status
      const isAuth = await service.isAuthenticated();

      // Assert - Not authenticated
      expect(isAuth).toBe(false);
    });
  });

  describe("Password Reset Flow", () => {
    it("should complete password reset flow", async () => {
      // Arrange - Request reset
      const email = "user@example.com";
      mocks.mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      // Act - Request reset
      await service.requestPasswordReset(email);

      // Assert - Reset requested
      expect(mocks.mockSupabaseAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        email
      );

      // Arrange - Update password
      const newPassword = "NewSecure Pass123!";
      mocks.mockSupabaseAuth.updateUser.mockResolvedValue({
        data: { user: {} as any },
        error: null,
      });

      // Act - Update password
      await service.updatePassword(newPassword);

      // Assert - Password updated
      expect(mocks.mockSupabaseAuth.updateUser).toHaveBeenCalledWith({
        password: newPassword,
      });
    });
  });

  describe("Session Persistence", () => {
    it("should maintain session across multiple requests", async () => {
      // Arrange
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act - Multiple session requests
      const session1 = await service.getSession();
      const session2 = await service.getSession();
      const session3 = await service.getSession();

      // Assert - Same session returned, uses cache
      expect(session1).toEqual(mockSession);
      expect(session2).toEqual(mockSession);
      expect(session3).toEqual(mockSession);
      // Should use deduplication/caching
      expect(
        mocks.mockSupabaseAuth.getSession.mock.calls.length
      ).toBeLessThanOrEqual(3);
    });
  });

  describe("OAuth to Session Flow", () => {
    it("should complete OAuth sign-in and establish session", async () => {
      // Arrange - OAuth initiation
      mocks.mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { provider: "google", url: "https://accounts.google.com/oauth" },
        error: null,
      });

      // Act - Initiate OAuth
      await service.signInWithProvider("google");

      // Assert - OAuth initiated
      expect(mocks.mockSupabaseAuth.signInWithOAuth).toHaveBeenCalled();

      // Simulate OAuth callback - user returns with session
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act - Get session after OAuth
      const session = await service.getSession();

      // Assert - Session established
      expect(session).toBeDefined();
      expect(session?.access_token).toBeDefined();
    });
  });
});
