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

  it("updates refresh token fingerprints on new sign-ins", () => {
    secureTokenManager.storeSession({
      access_token: "access-token-1",
      refresh_token: "refresh-token-1",
      expires_at: 1735689600,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    } as any);

    const initialFingerprint = localStorage.getItem(
      "valynt.auth.refresh.fingerprint",
    );

    secureTokenManager.storeSession({
      access_token: "access-token-2",
      refresh_token: "refresh-token-2",
      expires_at: 1735689700,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    } as any);

    const rotatedFingerprint = localStorage.getItem(
      "valynt.auth.refresh.fingerprint",
    );

    expect(initialFingerprint).not.toBeNull();
    expect(rotatedFingerprint).not.toBeNull();
    expect(rotatedFingerprint).not.toEqual(initialFingerprint);
    expect(localStorage.getItem("valynt.auth.state")).not.toBeNull();
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

  it("signs out when refresh tokens rotate without a refresh event", async () => {
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

    authCallback?.("USER_UPDATED", {
      access_token: "access-token-2",
      refresh_token: "refresh-token-2",
      expires_at: 1735689700,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("valynt.auth.state")).toBeNull();
    expect(
      localStorage.getItem("valynt.auth.refresh.fingerprint"),
    ).toBeNull();
  });
});
