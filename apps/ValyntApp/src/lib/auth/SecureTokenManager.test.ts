import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  },
}));

const { secureTokenManager } = await import("./SecureTokenManager");

describe("ValyntApp secureTokenManager", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not persist raw session token material to localStorage", () => {
    secureTokenManager.storeSession({
      access_token: "access-token-secret",
      refresh_token: "refresh-token-secret",
      expires_at: 1735689600,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    } as any);

    expect(localStorage.getItem("supabase.auth.token") ?? null).toBeNull();

    const storedValue = localStorage.getItem("valynt.auth.state");
    expect(storedValue).toContain("user-123");
    expect(storedValue).not.toContain("access-token-secret");
    expect(storedValue).not.toContain("refresh-token-secret");
  });

  it("rejects stale refresh-token reuse during refresh events", async () => {
    let authCallback: ((event: string, session: any) => void) | undefined;

    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await secureTokenManager.initialize();

    authCallback?.("SIGNED_IN", {
      access_token: "access-token-1",
      refresh_token: "refresh-token-1",
      expires_at: 1735689600,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    });

    authCallback?.("TOKEN_REFRESHED", {
      access_token: "access-token-2",
      refresh_token: "refresh-token-1",
      expires_at: 1735689700,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("valynt.auth.state")).toBeNull();
    expect(localStorage.getItem("valynt.auth.refresh.fingerprint")).toBeNull();
  });

  it("does not persist state when refresh tokens are missing", () => {
    secureTokenManager.storeSession({
      access_token: "access-token-1",
      refresh_token: "",
      expires_at: 1735689600,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    } as any);

    expect(localStorage.getItem("valynt.auth.state")).toBeNull();
  });

  it("returns null from getCurrentSession when session retrieval fails", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("bad token") });

    await expect(secureTokenManager.getCurrentSession()).resolves.toBeNull();
  });
});
