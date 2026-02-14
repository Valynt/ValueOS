import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });


const createStorageMock = () => {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  },
}));

let secureTokenManager: typeof import("./SecureTokenManager")["secureTokenManager"];

describe("ValyntApp secureTokenManager", () => {
  beforeEach(async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createStorageMock(),
    });

    vi.clearAllMocks();
    vi.resetModules();
    ({ secureTokenManager } = await import("./SecureTokenManager"));
  });

  it("does not persist raw session token material to localStorage", () => {
    const setItemSpy = vi.spyOn(sessionStorage, "setItem");

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
    expect(setItemSpy).toHaveBeenCalledTimes(2);

    const stateWrite = setItemSpy.mock.calls.find(
      ([key]) => key === "valynt.auth.state",
    );
    expect(stateWrite).toBeDefined();

    const [, storedValue] = stateWrite!;
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

    const initialFingerprint = sessionStorage.getItem(
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

    const rotatedFingerprint = sessionStorage.getItem(
      "valynt.auth.refresh.fingerprint",
    );

    expect(initialFingerprint).not.toBeNull();
    expect(rotatedFingerprint).not.toBeNull();
    expect(rotatedFingerprint).not.toEqual(initialFingerprint);
    expect(sessionStorage.getItem("valynt.auth.state")).not.toBeNull();
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

    expect(sessionStorage.getItem("valynt.auth.state")).toBeNull();
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
    expect(sessionStorage.getItem("valynt.auth.state")).toBeNull();
    expect(
      sessionStorage.getItem("valynt.auth.refresh.fingerprint"),
    ).toBeNull();
  });


  it("signs out when TOKEN_REFRESHED rotates the refresh token", async () => {
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
      refresh_token: "refresh-token-2",
      expires_at: 1735689700,
      user: {
        id: "user-123",
        email: "user@example.com",
      },
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("valynt.auth.state")).toBeNull();
    expect(
      sessionStorage.getItem("valynt.auth.refresh.fingerprint"),
    ).toBeNull();
  });

  it("signs out when TOKEN_REFRESHED reuses the same refresh token", async () => {
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
    expect(sessionStorage.getItem("valynt.auth.state")).toBeNull();
  });
});
