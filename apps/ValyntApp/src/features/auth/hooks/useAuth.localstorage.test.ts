/**
 * useAuth — localStorage write regression tests (Sprint 25 KR 25-1)
 *
 * Asserts that useAuth does NOT write user data to localStorage on render.
 * The legacy "manus-runtime-user-info" key must never be written.
 * The "manus-runtime-is-authenticated" key must never be written.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock trpc before importing the hook
vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      me: {
        useQuery: vi.fn(() => ({
          data: { id: "user-1", email: "test@example.com", role: "admin" },
          isLoading: false,
          error: null,
        })),
      },
      logout: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn().mockResolvedValue(undefined),
          isPending: false,
          error: null,
        })),
      },
    },
    useUtils: vi.fn(() => ({
      auth: {
        me: {
          setData: vi.fn(),
          invalidate: vi.fn().mockResolvedValue(undefined),
        },
      },
    })),
  },
}));

vi.mock("@/const", () => ({
  getLoginUrl: () => "/login",
}));

import { renderHook } from "@testing-library/react";
import { useAuth } from "./useAuth";

describe("useAuth — localStorage writes", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(localStorage, "setItem");
  });

  it("does NOT write manus-runtime-is-authenticated to localStorage on render", () => {
    renderHook(() => useAuth());
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "manus-runtime-is-authenticated",
      expect.anything()
    );
  });

  it("does NOT write manus-runtime-user-info to localStorage on render", () => {
    renderHook(() => useAuth());
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "manus-runtime-user-info",
      expect.anything()
    );
  });

  it("does NOT write any user profile data to localStorage", () => {
    renderHook(() => useAuth());
    const calls = (localStorage.setItem as ReturnType<typeof vi.spyOn>).mock.calls;
    const profileWrites = calls.filter(([key]) =>
      key.includes("user") || key.includes("auth") || key.includes("manus")
    );
    expect(profileWrites).toHaveLength(0);
  });
});
