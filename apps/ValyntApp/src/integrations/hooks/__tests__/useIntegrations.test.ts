import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetIntegrations,
  mockGetCrmProviderCapabilities,
  mockCreateIntegration,
  mockApiClientGet,
  mockApiClientPost,
  mockWindowOpen,
} = vi.hoisted(
  () => ({
    mockGetIntegrations: vi.fn(),
    mockGetCrmProviderCapabilities: vi.fn(),
    mockCreateIntegration: vi.fn(),
    mockApiClientGet: vi.fn(),
    mockApiClientPost: vi.fn(),
    mockWindowOpen: vi.fn(),
  })
);

vi.mock("@/api/client/unified-api-client", () => ({
  api: {
    getIntegrations: mockGetIntegrations,
    getCrmProviderCapabilities: mockGetCrmProviderCapabilities,
    createIntegration: mockCreateIntegration,
    deleteIntegration: vi.fn(),
    testIntegration: vi.fn(),
    syncIntegration: vi.fn(),
  },
  apiClient: {
    get: mockApiClientGet,
    post: mockApiClientPost,
  },
}));

import { useIntegrations } from "../useIntegrations";

describe("useIntegrations OAuth flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", mockWindowOpen);
    mockGetCrmProviderCapabilities.mockResolvedValue({
      success: true,
      data: {
        providers: [
          {
            provider: "salesforce",
            capabilities: {
              oauth: true,
              webhookSupport: true,
              deltaSync: true,
              manualSync: true,
              fieldMapping: true,
              backfill: true,
            },
          },
          {
            provider: "hubspot",
            capabilities: {
              oauth: true,
              webhookSupport: true,
              deltaSync: true,
              manualSync: true,
              fieldMapping: true,
              backfill: true,
            },
          },
        ],
      },
    });
  });

  it("surfaces popup blocked errors when OAuth popup cannot open", async () => {
    mockApiClientPost.mockResolvedValue({
      success: true,
      data: { authUrl: "https://crm.example.com/oauth/start" },
    });
    mockWindowOpen.mockReturnValue(null);

    const { result } = renderHook(() => useIntegrations());

    await act(async () => {
      await result.current.connect("salesforce");
    });

    expect(mockApiClientPost).toHaveBeenCalledWith("/api/crm/salesforce/connect/start");
    expect(result.current.error).toBe("Popup blocked. Please allow popups and try again.");
    expect(result.current.oauthInProgressProvider).toBeNull();
  });

  it("refreshes integrations + CRM status/health when oauth callback succeeds", async () => {
    mockGetIntegrations.mockResolvedValue({
      success: true,
      data: {
        integrations: [],
      },
    });
    mockApiClientGet.mockImplementation((url: string) => {
      if (url === "/api/crm/salesforce/status") {
        return Promise.resolve({
          success: true,
          data: {
            connected: true,
            status: "active",
            lastSyncAt: "2026-04-05T12:00:00.000Z",
          },
        });
      }
      if (url === "/api/crm/salesforce/health") {
        return Promise.resolve({
          success: true,
          data: {
            status: "active",
          },
        });
      }
      return Promise.resolve({ success: false, error: { message: "Unknown endpoint" } });
    });

    const { result } = renderHook(() => useIntegrations());

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "crm-oauth-complete", provider: "salesforce" },
        })
      );
    });

    await waitFor(() => {
      expect(mockGetIntegrations).toHaveBeenCalled();
      expect(mockApiClientGet).toHaveBeenCalledWith("/api/crm/salesforce/status");
      expect(mockApiClientGet).toHaveBeenCalledWith("/api/crm/salesforce/health");
    });

    expect(result.current.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "salesforce",
          status: "connected",
          lastSyncAt: "2026-04-05T12:00:00.000Z",
        }),
      ])
    );
  });

  it("surfaces oauth callback errors from postMessage", async () => {
    const { result } = renderHook(() => useIntegrations());

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "crm-oauth-error", error: "Authorization denied" },
        })
      );
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Authorization denied");
    });
    expect(result.current.oauthInProgressProvider).toBeNull();
  });

  it("supports reconnect flow for an already connected oauth provider", async () => {
    mockGetIntegrations.mockResolvedValue({
      success: true,
      data: {
        integrations: [
          {
            id: "integration-1",
            provider: "salesforce",
            status: "active",
          },
        ],
      },
    });
    mockApiClientPost.mockResolvedValue({
      success: true,
      data: { authUrl: "https://crm.example.com/oauth/reconnect" },
    });
    mockWindowOpen.mockReturnValue({ closed: false });

    const { result } = renderHook(() => useIntegrations());

    await act(async () => {
      await result.current.fetchIntegrations();
    });

    expect(result.current.integrations[0]?.status).toBe("connected");

    await act(async () => {
      await result.current.connect("salesforce");
    });

    expect(mockApiClientPost).toHaveBeenCalledWith("/api/crm/salesforce/connect/start");
    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://crm.example.com/oauth/reconnect",
      "crm-oauth-salesforce",
      "popup=yes,width=600,height=720"
    );
    expect(result.current.oauthInProgressProvider).toBe("salesforce");
  });

  it("does not send direct token payloads to createIntegration for CRM OAuth providers", async () => {
    mockApiClientPost.mockResolvedValue({
      success: true,
      data: { authUrl: "https://crm.example.com/oauth/start" },
    });
    mockWindowOpen.mockReturnValue({ closed: false });

    const { result } = renderHook(() => useIntegrations());

    await act(async () => {
      await result.current.connect("hubspot", { accessToken: "should-not-be-used" });
    });

    expect(mockApiClientPost).toHaveBeenCalledWith("/api/crm/hubspot/connect/start");
    expect(mockCreateIntegration).not.toHaveBeenCalled();
  });
});
