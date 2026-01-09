import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecureTokenManager } from "../SecureTokenManager";
import { Session } from "@supabase/supabase-js";

// Mock Supabase client
vi.mock("../../supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
      setSession: vi.fn(),
    },
  },
}));

// Mock Logger
vi.mock("../../logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("SecureTokenManager", () => {
  let manager: SecureTokenManager;
  const mockDate = new Date("2026-01-01T12:00:00Z");

  // Mock Session Data
  const mockSession: Session = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(mockDate.getTime() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "mock-user-id",
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: mockDate.toISOString(),
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    // Reset singleton if possible or get instance
    // Since it's a singleton, we need to be careful.
    // We can cast to any to access private members or just verify public API.
    manager = SecureTokenManager.getInstance();

    // Clear storage mocks
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("localStorage", {
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("Session Storage Persistence", () => {
    it("should securely store session in sessionStorage with metadata", () => {
      manager.storeSession(mockSession);

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        "vc_session_v2",
        expect.stringContaining('"access_token":"mock-access-token"')
      );

      // Verify metadata was added
      const storedCall = vi.mocked(sessionStorage.setItem).mock.calls[0];
      const storedData = JSON.parse(storedCall[1] as string);

      expect(storedData.storedAt).toBe(mockDate.getTime());
      expect(storedData.rotatedAt).toBe(mockDate.getTime());
    });

    it("should retrieve valid session from storage", () => {
      const storedData = {
        ...mockSession,
        storedAt: mockDate.getTime(),
        rotatedAt: mockDate.getTime(),
      };

      vi.mocked(sessionStorage.getItem).mockReturnValue(
        JSON.stringify(storedData)
      );

      const retrieved = manager.getStoredSession();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.access_token).toBe(mockSession.access_token);
    });

    it("should clear session if max age exceeded", () => {
      const eightHoursOneMinute = 8 * 60 * 60 * 1000 + 60000;
      const storedData = {
        ...mockSession,
        storedAt: mockDate.getTime() - eightHoursOneMinute,
        rotatedAt: mockDate.getTime(),
      };

      vi.mocked(sessionStorage.getItem).mockReturnValue(
        JSON.stringify(storedData)
      );

      const retrieved = manager.getStoredSession();

      expect(retrieved).toBeNull();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith("vc_session_v2");
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "supabase.auth.token"
      );
    });

    it("should rotate session timestamp if interval exceeded", () => {
      const sixteenMinutes = 16 * 60 * 1000;
      const storedData = {
        ...mockSession,
        storedAt: mockDate.getTime(),
        rotatedAt: mockDate.getTime() - sixteenMinutes,
      };

      vi.mocked(sessionStorage.getItem).mockReturnValue(
        JSON.stringify(storedData)
      );

      const retrieved = manager.getStoredSession();

      expect(retrieved).not.toBeNull();
      expect(sessionStorage.setItem).toHaveBeenCalledTimes(1); // Re-save means rotation

      const storedCall = vi.mocked(sessionStorage.setItem).mock.calls[0];
      const newData = JSON.parse(storedCall[1] as string);
      expect(newData.rotatedAt).toBe(mockDate.getTime());
    });
  });

  describe("Logout Cleanup", () => {
    it("should clear storage on logout", async () => {
      await manager.logout();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith("vc_session_v2");
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "supabase.auth.token"
      );
    });
  });
});
