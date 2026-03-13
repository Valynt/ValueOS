/**
 * AuthContext unit tests
 *
 * Covers all auth methods and state transitions. Supabase, SecureTokenManager,
 * analyticsClient, and env are mocked to prevent network calls and ensure
 * initAuth does not early-exit (leaving loading: true indefinitely).
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock factories must not reference outer-scope variables (hoisting).
// Use vi.fn() inline; retrieve references via vi.mocked() after import.

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
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
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

// Return non-empty config so initAuth does not early-exit leaving loading:true
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

// Import after mocks are registered
import { supabase } from "../../lib/supabase";
import { secureTokenManager } from "../../lib/auth/SecureTokenManager";
import { AuthProvider, useAuth } from "../AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const makeUser = (overrides = {}) => ({
  id: "user-1",
  email: "test@example.com",
  created_at: "2026-01-01T00:00:00Z",
  user_metadata: { roles: ["member"], org_id: "org-1" },
  ...overrides,
});

const makeSession = (userOverrides = {}) => ({
  access_token: "tok",
  refresh_token: "ref",
  expires_at: Date.now() / 1000 + 3600,
  user: makeUser(userOverrides),
});

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish defaults after clearAllMocks resets return values
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(null);
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(null);
    vi.mocked(secureTokenManager.initialize).mockResolvedValue(undefined);
    vi.mocked(supabase!.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as ReturnType<typeof supabase.auth.onAuthStateChange>);
  });

  // --- isAuthenticated ---

  it("isAuthenticated is false when no user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("isAuthenticated is true when stored session is restored", async () => {
    const session = makeSession();
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(session as never);
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(session as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.id).toBe("user-1");
  });

  // --- login ---

  it("login: success sets user, session, and userClaims", async () => {
    const session = makeSession();
    vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user as never, session: session as never },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login({ email: "test@example.com", password: "password123" });
    });

    expect(result.current.user?.id).toBe("user-1");
    expect(result.current.session).toBe(session);
    expect(result.current.userClaims?.sub).toBe("user-1");
  });

  it("login: Supabase error throws", async () => {
    vi.mocked(supabase!.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid credentials", status: 400, name: "AuthError" } as never,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login({ email: "bad@example.com", password: "wrongpass" });
      })
    ).rejects.toThrow();
  });

  // --- signup ---

  it("signup: with session sets user state immediately", async () => {
    const session = makeSession();
    vi.mocked(supabase!.auth.signUp).mockResolvedValue({
      data: { user: session.user as never, session: session as never },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let authSession: { requiresEmailVerification: boolean } | undefined;
    await act(async () => {
      authSession = await result.current.signup({
        email: "new@example.com",
        password: "password123",
      });
    });

    expect(authSession?.requiresEmailVerification).toBe(false);
    expect(result.current.user?.id).toBe("user-1");
  });

  it("signup: without session requires email verification", async () => {
    const user = makeUser();
    vi.mocked(supabase!.auth.signUp).mockResolvedValue({
      data: { user: user as never, session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let authSession: { requiresEmailVerification: boolean } | undefined;
    await act(async () => {
      authSession = await result.current.signup({
        email: "pending@example.com",
        password: "password123",
      });
    });

    expect(authSession?.requiresEmailVerification).toBe(true);
    expect(result.current.user).toBeNull();
  });

  // --- logout ---

  it("logout: clears user and session state", async () => {
    const session = makeSession();
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(session as never);
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(session as never);
    vi.mocked(supabase!.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  // --- resetPassword ---

  it("resetPassword: calls supabase.auth.resetPasswordForEmail", async () => {
    vi.mocked(supabase!.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resetPassword("user@example.com");
    });

    expect(supabase!.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") })
    );
  });

  // --- signInWithProvider ---

  it("signInWithProvider: calls supabase.auth.signInWithOAuth with correct provider", async () => {
    vi.mocked(supabase!.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: "google", url: "" },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signInWithProvider("google");
    });

    expect(supabase!.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" })
    );
  });

  // --- onAuthStateChange ---

  it("SIGNED_OUT event clears state and calls clearSessionStorage", async () => {
    let capturedHandler: ((event: string, session: null) => void) | undefined;
    vi.mocked(supabase!.auth.onAuthStateChange).mockImplementation((handler) => {
      capturedHandler = handler as typeof capturedHandler;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as ReturnType<
        typeof supabase.auth.onAuthStateChange
      >;
    });

    const session = makeSession();
    vi.mocked(secureTokenManager.getStoredSession).mockReturnValue(session as never);
    vi.mocked(secureTokenManager.getCurrentSession).mockResolvedValue(session as never);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    act(() => {
      capturedHandler?.("SIGNED_OUT", null);
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(secureTokenManager.clearSessionStorage).toHaveBeenCalled();
  });

  it("SIGNED_IN event stores session via secureTokenManager", async () => {
    let capturedHandler: ((event: string, session: unknown) => void) | undefined;
    vi.mocked(supabase!.auth.onAuthStateChange).mockImplementation((handler) => {
      capturedHandler = handler as typeof capturedHandler;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as ReturnType<
        typeof supabase.auth.onAuthStateChange
      >;
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const session = makeSession();
    act(() => {
      capturedHandler?.("SIGNED_IN", session);
    });

    await waitFor(() => expect(result.current.user?.id).toBe("user-1"));
    expect(secureTokenManager.storeSession).toHaveBeenCalledWith(session);
  });
});
