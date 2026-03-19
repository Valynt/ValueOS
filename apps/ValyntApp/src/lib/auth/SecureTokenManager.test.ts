import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn();

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

vi.mock("../supabase", () => {
  const supabase = {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    rpc: mockRpc,
  };

  return {
    supabase,
    createBrowserSupabaseClient: vi.fn(() => supabase),
    createRequestSupabaseClient: vi.fn(() => supabase),
    createServerSupabaseClient: vi.fn(() => supabase),
    getSupabaseClient: vi.fn(() => supabase),
  };
});

let secureTokenManager: typeof import("./SecureTokenManager")["secureTokenManager"];

const buildSession = (refreshToken: string, accessToken: string) =>
  ({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: 1735689600,
    user: {
      id: "user-123",
      email: "user@example.com",
    },
  }) as never;

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
    mockRpc.mockResolvedValue({ data: { trusted: true }, error: null });
    vi.resetModules();
    ({ secureTokenManager } = await import("./SecureTokenManager"));
  });

  it("does not persist raw session token material to localStorage", async () => {
    const setItemSpy = vi.spyOn(sessionStorage, "setItem");

    await secureTokenManager.storeSession(buildSession("refresh-token-secret", "access-token-secret"));

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

  it("accepts legitimate refresh rotation on TOKEN_REFRESHED", async () => {
    let authCallback: ((event: string, session: never) => void) | undefined;

    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await secureTokenManager.initialize();

    authCallback?.("SIGNED_IN", buildSession("refresh-token-1", "access-token-1"));
    authCallback?.("TOKEN_REFRESHED", buildSession("refresh-token-2", "access-token-2"));

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(0);
      expect(sessionStorage.getItem("valynt.auth.state")).not.toBeNull();
    });
  });

  it("rejects replayed old refresh token when backend marks it untrusted", async () => {
    let authCallback: ((event: string, session: never) => void) | undefined;

    mockRpc.mockResolvedValue({
      data: { trusted: false, replayDetected: true },
      error: null,
    });

    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await secureTokenManager.initialize();

    authCallback?.("SIGNED_IN", buildSession("refresh-token-1", "access-token-1"));
    authCallback?.("TOKEN_REFRESHED", buildSession("refresh-token-2", "access-token-2"));

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
    expect(sessionStorage.getItem("valynt.auth.state")).toBeNull();
  });

  it("rejects impossible TOKEN_REFRESHED replay transition", async () => {
    let authCallback: ((event: string, session: never) => void) | undefined;

    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await secureTokenManager.initialize();

    authCallback?.("SIGNED_IN", buildSession("refresh-token-1", "access-token-1"));
    authCallback?.("TOKEN_REFRESHED", buildSession("refresh-token-1", "access-token-2"));

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it("supports SIGNED_IN / INITIAL_SESSION / TOKEN_REFRESHED transition matrix", async () => {
    let authCallback: ((event: string, session: never) => void) | undefined;

    mockOnAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await secureTokenManager.initialize();

    authCallback?.("INITIAL_SESSION", buildSession("refresh-token-0", "access-token-0"));
    authCallback?.("SIGNED_IN", buildSession("refresh-token-1", "access-token-1"));
    authCallback?.("TOKEN_REFRESHED", buildSession("refresh-token-2", "access-token-2"));

    await vi.waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(0);
    });

    await vi.waitFor(() => {
      expect(sessionStorage.getItem("valynt.auth.state")).not.toBeNull();
    });
    expect(sessionStorage.getItem("valynt.auth.refresh.fingerprint")).not.toBeNull();
  });
});
