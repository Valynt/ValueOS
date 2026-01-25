import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIntegrations } from "../useIntegrations";
import { useAuth } from "../../../contexts/AuthContext";

// Mock useAuth
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe("useIntegrations", () => {
  const mockSession = {
    access_token: "mock-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ session: mockSession });
  });

  it("should fetch integrations successfully", async () => {
    const mockIntegrations = [
      { id: "1", name: "Salesforce", status: "connected" },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ integrations: mockIntegrations }),
    });

    const { result } = renderHook(() => useIntegrations());

    await act(async () => {
      await result.current.fetchIntegrations();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/integrations", {
      headers: {
        Authorization: "Bearer mock-token",
      },
    });

    expect(result.current.integrations).toEqual(mockIntegrations);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it("should handle fetch error", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => useIntegrations());

    await act(async () => {
      await result.current.fetchIntegrations();
    });

    expect(result.current.error).toBe("Failed to fetch integrations");
    expect(result.current.isLoading).toBe(false);
  });

  it("should not fetch if no session", async () => {
    (useAuth as any).mockReturnValue({ session: null });

    const { result } = renderHook(() => useIntegrations());

    await act(async () => {
      await result.current.fetchIntegrations();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
