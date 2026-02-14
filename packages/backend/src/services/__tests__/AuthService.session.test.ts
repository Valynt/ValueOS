/**
 * AuthService Session Management Unit Tests
 * Tests session retrieval, refresh, logout, and cache management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../AuthService.js"
import { AuthenticationError } from "../errors.js"
import {
  createMockSession,
  createMockUser,
  createAuthErrorResponse,
} from "../../test-utils/auth.fixtures";
import { setupAuthMocks, resetAuthMocks } from "../../test-utils/auth.helpers";

// Setup mocks
const mocks = setupAuthMocks();

vi.mock("../../lib/supabase", () => ({
  supabase: { auth: mocks.mockSupabaseAuth },
}));

vi.mock("../../security", async () => {
  const actual = await vi.importActual<typeof import("../../security")>("../../security");
  return {
    ...actual,
    consumeAuthRateLimit: mocks.mockConsumeAuthRateLimit,
    resetRateLimit: mocks.mockResetRateLimit,
    checkPasswordBreach: mocks.mockCheckPasswordBreach,
  };
});

vi.mock("../../config/environment", async () => {
  const actual = await vi.importActual<typeof import("../../config/environment")>(
    "../../config/environment"
  );
  return {
    ...actual,
    getConfig: mocks.mockGetConfig,
  };
});

vi.mock("../ClientRateLimit", () => ({
  clientRateLimit: mocks.mockClientRateLimit,
}));

describe("AuthService - Session Management", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    resetAuthMocks(mocks);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Get Session", () => {
    it("should retrieve current session successfully", async () => {
      // Arrange
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act
      const result = await service.getSession();

      // Assert
      expect(result).toEqual(mockSession);
      expect(mocks.mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    it("should return null when no session exists", async () => {
      // Arrange
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      const result = await service.getSession();

      // Assert
      expect(result).toBeNull();
    });

    it("should throw AuthenticationError on Supabase error", async () => {
      // Arrange
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Session expired", status: 401, name: "AuthApiError" },
      });

      // Act & Assert
      await expect(service.getSession()).rejects.toThrow(AuthenticationError);
    });

    it("should use deduplication for concurrent requests", async () => {
      // Arrange
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act - Make two concurrent requests
      const [result1, result2] = await Promise.all([service.getSession(), service.getSession()]);

      // Assert
      expect(result1).toEqual(mockSession);
      expect(result2).toEqual(mockSession);
      // Should only call Supabase once due to deduplication
      expect(mocks.mockSupabaseAuth.getSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("Get Current User", () => {
    it("should retrieve current user successfully", async () => {
      // Arrange
      const mockUser = createMockUser();
      mocks.mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Act
      const result = await service.getCurrentUser();

      // Assert
      expect(result).toEqual(mockUser);
      expect(mocks.mockSupabaseAuth.getUser).toHaveBeenCalled();
    });

    it("should return null when no user is authenticated", async () => {
      // Arrange
      mocks.mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Act
      const result = await service.getCurrentUser();

      // Assert
      expect(result).toBeNull();
    });

    it("should throw AuthenticationError on Supabase error", async () => {
      // Arrange
      mocks.mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token", status: 401, name: "AuthApiError" },
      });

      // Act & Assert
      await expect(service.getCurrentUser()).rejects.toThrow(AuthenticationError);
    });
  });

  describe("Refresh Session", () => {
    it("should successfully refresh session", async () => {
      // Arrange
      const mockUser = createMockUser();
      const mockSession = createMockSession({ user: mockUser });
      mocks.mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Act
      const result = await service.refreshSession();

      // Assert
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(mocks.mockSupabaseAuth.refreshSession).toHaveBeenCalled();
    });

    it("should throw AuthenticationError when refresh fails", async () => {
      // Arrange
      mocks.mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Refresh token expired", status: 401, name: "AuthApiError" },
      });

      // Act & Assert
      await expect(service.refreshSession()).rejects.toThrow(AuthenticationError);
    });
    it("should throw AuthenticationError when refresh token is stale/reused", async () => {
      // Arrange
      mocks.mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: "Invalid Refresh Token: Already Used",
          status: 401,
          name: "AuthApiError",
        },
      });

      // Act & Assert
      await expect(service.refreshSession()).rejects.toThrow(AuthenticationError);
    });

    it("should throw AuthenticationError when user is null after refresh", async () => {
      // Arrange
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { user: null, session: mockSession },
        error: null,
      });

      // Act & Assert
      await expect(service.refreshSession()).rejects.toThrow(AuthenticationError);
      await expect(service.refreshSession()).rejects.toThrow("Session refresh failed");
    });

    it("should throw AuthenticationError when session is null after refresh", async () => {
      // Arrange
      const mockUser = createMockUser();
      mocks.mockSupabaseAuth.refreshSession.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      // Act & Assert
      await expect(service.refreshSession()).rejects.toThrow(AuthenticationError);
      await expect(service.refreshSession()).rejects.toThrow("Session refresh failed");
    });
  });

  describe("Logout", () => {
    it("should successfully logout user", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signOut.mockResolvedValue({
        error: null,
      });

      // Act
      await service.logout();

      // Assert
      expect(mocks.mockSupabaseAuth.signOut).toHaveBeenCalled();
    });

    it("should throw AuthenticationError on logout failure", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signOut.mockResolvedValue({
        error: { message: "Logout failed", status: 500, name: "AuthApiError" },
      });

      // Act & Assert
      await expect(service.logout()).rejects.toThrow(AuthenticationError);
    });

    it("should clear cache after logout", async () => {
      // Arrange
      mocks.mockSupabaseAuth.signOut.mockResolvedValue({
        error: null,
      });

      // Mock getSession to verify cache clearing
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Populate cache by getting session
      await service.getSession();

      // Act - Logout should clear cache
      await service.logout();

      // Assert - Next getSession should call Supabase again (not use cache)
      await service.getSession();
      expect(mocks.mockSupabaseAuth.getSession).toHaveBeenCalledTimes(2);
    });
  });

  describe("Is Authenticated", () => {
    it("should return true when session exists", async () => {
      // Arrange
      const mockSession = createMockSession();
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Act
      const result = await service.isAuthenticated();

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when no session exists", async () => {
      // Arrange
      mocks.mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      const result = await service.isAuthenticated();

      // Assert
      expect(result).toBe(false);
    });
  });
});
