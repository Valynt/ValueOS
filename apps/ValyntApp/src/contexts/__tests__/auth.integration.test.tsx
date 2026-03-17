/**
 * Auth lifecycle integration tests
 *
 * Uses a real AuthProvider wrapper with all external dependencies mocked.
 * Tests the full state machine: login → authenticated → logout → unauthenticated.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      resend: vi.fn(),
      signInWithOAuth: vi.fn(),
      onAuthStateChange: vi.fn((handler) => {
        // Store handler for test-controlled firing
        (globalThis as Record<string, unknown>).__authStateHandler = handler;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

vi.mock("../../lib/auth/SecureTokenManager", () => ({
  secureTokenManager: {
    getStoredSession: vi.fn(() => null),
    getCurrentSession: vi.fn(async () => null),
    initialize: vi.fn(async () => {}),
    storeSession: vi.fn(),
    clearSessionStorage: vi.fn(),
  },
}));

vi.mock("../../lib/analyticsClient", () => ({
  analyticsClient: { identify: vi.fn(), track: vi.fn() },
}));

vi.mock("../../lib/env", () => ({
  getSupabaseConfig: vi.fn(() => ({
    url: "https://test.supabase.co",
    anonKey: "test-anon-key",
  })),
}));

vi.mock("../../api/client/unified-api-client", () => ({
  apiClient: { setAuthToken: vi.fn(), clearAuthToken: vi.fn() },
}));

vi.mock("../../lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { secureTokenManager } from "../../lib/auth/SecureTokenManager";
import { supabase } from "../../lib/supabase";
import { AuthProvider, useAuth } from "../AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const makeUser = () => ({
  id: "user-1",
  email: "test@example.com",
  created_at: "2026-01-01T00:00:00Z",
  user_metadata: { roles: ["member"], org_id: "org-1" },
});

const makeSession = () => ({
  access_token: "tok",
  refresh_token: "ref",
  expires_at: Date.now() / 1000 + 3600,
  user: makeUser(),
});

describe("Auth lifecycle integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(null);
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(null);
    vi.mocked(secureTokenManager.initialize).mockResolvedValue(undefined);
    vi.mocked(supabase!.auth.onAuthStateChange).mockImplementation((handler) => {
      (globalThis as Record<string, unknown>).__authStateHandler = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as ReturnType<
        typeof supabase.auth.onAuthStateChange
      >;
    });
  });

  it("login → isAuthenticated true → logout → isAuthenticated false", async () => {
    const session = makeSession();
    vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user as never, session: session as never },
      error: null,
    });
    vi.mocked(supabase!.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login({ email: "test@example.com", password: "password123" });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe("user-1");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("OAuth callback: stored session → onAuthStateChange SIGNED_IN → user state populated", async () => {
    const session = makeSession();
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(session as never);
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(session as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Optimistic restore from stored session
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.id).toBe("user-1");

    // Simulate onAuthStateChange SIGNED_IN from OAuth callback
    const handler = (globalThis as Record<string, unknown>).__authStateHandler as (
      event: string,
      session: unknown
    ) => void;
    act(() => {
      handler("SIGNED_IN", session);
    });

    await waitFor(() => expect(result.current.user?.id).toBe("user-1"));
    expect(secureTokenManager.storeSession).toHaveBeenCalledWith(session);
  });

  it("expired session: background check clears optimistic state", async () => {
    const session = makeSession();
    // Optimistic restore succeeds
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(session as never);
    // Background check fails (token expired remotely)
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // After background check fails, state is cleared
    await waitFor(() => expect(result.current.user).toBeNull(), { timeout: 2000 });
    expect(secureTokenManager.clearSessionStorage).toHaveBeenCalled();
  });
});
