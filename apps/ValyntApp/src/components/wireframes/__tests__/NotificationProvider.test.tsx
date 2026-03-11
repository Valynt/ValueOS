/**
 * NotificationProvider — unit tests
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  setAuthToken: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: mocks.get,
    patch: mocks.patch,
    post: mocks.post,
    setAuthToken: mocks.setAuthToken,
  },
}));

vi.mock("@/lib/realtime/supabaseRealtime", () => ({
  getRealtimeService: () => ({
    subscribeToNotifications: (_orgId: string, cb: (p: unknown) => void) => {
      (globalThis as Record<string, unknown>).__notifCb = cb;
      return mocks.unsubscribe;
    },
  }),
}));

import { NotificationProvider, useNotifications } from "../NotificationCenter";
import { WireframeAuthContext } from "../WireframeAuthContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH = { userId: "user-1", organizationId: "org-1", accessToken: "tok-abc" };

function wrapper({ children }: { children: ReactNode }) {
  return (
    <WireframeAuthContext.Provider value={AUTH}>
      <NotificationProvider>{children}</NotificationProvider>
    </WireframeAuthContext.Provider>
  );
}

const MOCK_ROW = {
  id: "n-live-1",
  organization_id: "org-1",
  user_id: "user-1",
  category: "agent",
  priority: "high",
  title: "Live notification",
  description: "From API",
  source: "TestAgent",
  action_label: null,
  action_route: null,
  read: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotificationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).__notifCb;
    mocks.get.mockResolvedValue({ success: true, data: { data: [] } });
    mocks.patch.mockResolvedValue({ success: true });
    mocks.post.mockResolvedValue({ success: true });
  });

  it("renders with mock data before API responds", () => {
    mocks.get.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.notifications.length).toBeGreaterThan(0);
  });

  it("replaces mock data with API response on hydration", async () => {
    mocks.get.mockResolvedValue({ success: true, data: { data: [MOCK_ROW] } });
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(result.current.notifications.some((n) => n.id === "n-live-1")).toBe(true);
    });
  });

  it("appends a new notification from Realtime broadcast", async () => {
    mocks.get.mockResolvedValue({ success: true, data: { data: [] } });
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() =>
      expect((globalThis as Record<string, unknown>).__notifCb).toBeDefined()
    );

    const broadcastRow = { ...MOCK_ROW, id: "n-broadcast-1", title: "Broadcast!" };
    act(() => {
      ((globalThis as Record<string, unknown>).__notifCb as (p: unknown) => void)(broadcastRow);
    });

    expect(result.current.notifications[0].id).toBe("n-broadcast-1");
  });

  it("markAsRead optimistically updates state and calls PATCH", async () => {
    mocks.get.mockResolvedValue({ success: true, data: { data: [MOCK_ROW] } });
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() =>
      expect(result.current.notifications.some((n) => n.id === "n-live-1")).toBe(true)
    );

    act(() => { result.current.markAsRead("n-live-1"); });

    expect(result.current.notifications.find((n) => n.id === "n-live-1")?.read).toBe(true);
    expect(mocks.patch).toHaveBeenCalledWith(
      "/api/v1/notifications/n-live-1/read",
      undefined,
      { headers: { Authorization: "Bearer tok-abc" } }
    );
  });

  it("markAllAsRead marks all notifications read and calls POST", async () => {
    mocks.get.mockResolvedValue({ success: true, data: { data: [{ ...MOCK_ROW, read: false }] } });
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBeGreaterThan(0));

    act(() => { result.current.markAllAsRead(); });

    expect(result.current.unreadCount).toBe(0);
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/v1/notifications/read-all",
      undefined,
      { headers: { Authorization: "Bearer tok-abc" } }
    );
  });

  it("unsubscribes from Realtime on unmount", async () => {
    mocks.get.mockResolvedValue({ success: true, data: { data: [] } });
    const { unmount } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() =>
      expect((globalThis as Record<string, unknown>).__notifCb).toBeDefined()
    );

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });
});
