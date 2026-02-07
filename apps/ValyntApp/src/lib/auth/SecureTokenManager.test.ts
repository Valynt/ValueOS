import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();
let authStateCallback: ((event: string, session: any) => void) | null = null;

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
    authStateCallback = null;
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
  });

  it("does not persist raw session token material to localStorage", () => {
    const setItemSpy = vi.spyOn(localStorage, "setItem");

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
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    const [storedKey, storedValue] = setItemSpy.mock.calls[0];
    expect(storedKey).toBe("valynt.auth.state");
    expect(storedValue).toContain("user-123");
    expect(storedValue).not.toContain("access-token-secret");
    expect(storedValue).not.toContain("refresh-token-secret");
  });

  it("invalidates and clears state when refresh tokens rotate during storage", () => {
    const removeItemSpy = vi.spyOn(localStorage, "removeItem");

    secureTokenManager.storeSession({
      access_token: "access-token-1",
      refresh_token: "refresh-token-1",
      expires_at: 1735689600,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    } as any);

    secureTokenManager.storeSession({
      access_token: "access-token-2",
      refresh_token: "refresh-token-2",
      expires_at: 1735689700,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    } as any);

    expect(removeItemSpy).toHaveBeenCalledWith("valynt.auth.state");
    expect(removeItemSpy).toHaveBeenCalledWith("supabase.auth.token");
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("valynt.auth.state")).toBeNull();
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

  it("invalidates and signs out when refresh tokens rotate unexpectedly", async () => {
    await secureTokenManager.initialize();
    expect(authStateCallback).not.toBeNull();

    localStorage.setItem("valynt.auth.state", "cached");
    localStorage.setItem("supabase.auth.token", "cached-token");

    authStateCallback?.("SIGNED_IN", {
      refresh_token: "refresh-token-1",
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    });

    authStateCallback?.("USER_UPDATED", {
      refresh_token: "refresh-token-2",
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("valynt.auth.state")).toBeNull();
    expect(localStorage.getItem("supabase.auth.token")).toBeNull();
  });
});
