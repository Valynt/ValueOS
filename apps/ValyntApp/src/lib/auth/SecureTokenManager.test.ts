import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
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
});
