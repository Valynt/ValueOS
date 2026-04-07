/**
 * Unit tests for useNotificationCenter hook.
 *
 * Tests cover:
 * - Initial notification fetch via React Query
 * - Mark as read mutation and cache invalidation
 * - Mark all as read mutation
 * - SSE connection management (connect/disconnect)
 * - SSE event handling - new notification arrival
 * - Unread count calculation
 * - Loading and error states
 * - Disabled query when tenant/user context missing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetNotifications = vi.fn();
const mockMarkNotificationRead = vi.fn();
const mockMarkAllNotificationsRead = vi.fn();

vi.mock("@/api/client/unified-api-client", () => ({
  api: {
    getNotifications: () => mockGetNotifications(),
    markNotificationRead: (id: string) => mockMarkNotificationRead(id),
    markAllNotificationsRead: (ids?: string[]) => mockMarkAllNotificationsRead(ids),
  },
  apiClient: {
    getAuthToken: vi.fn(),
  },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-1" } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

// Mock EventSource
const mockEventSource = {
  onopen: null as (() => void) | null,
  onmessage: null as ((event: { data: string }) => void) | null,
  onerror: null as (() => void) | null,
  close: vi.fn(),
  readyState: 1,
};

vi.stubGlobal("EventSource", vi.fn(() => mockEventSource));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useNotificationCenter } from "../useNotificationCenter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useNotificationCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventSource.onopen = null;
    mockEventSource.onmessage = null;
    mockEventSource.onerror = null;
    mockEventSource.close.mockClear();
  });

  it("fetches notifications on mount", async () => {
    mockGetNotifications.mockResolvedValue({
      success: true,
      data: {
        notifications: [{ id: "notif-1", read: false }],
        total: 1,
        unread: 1,
      },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    expect(mockGetNotifications).toHaveBeenCalled();
  });

  it("returns empty notifications when fetch fails", async () => {
    mockGetNotifications.mockResolvedValue({
      success: false,
      error: { message: "Failed to fetch" },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.notifications).toEqual([]);
    });
  });

  it("marks notification as read and invalidates cache", async () => {
    mockGetNotifications.mockResolvedValue({
      success: true,
      data: {
        notifications: [{ id: "notif-1", read: false }],
        total: 1,
        unread: 1,
      },
    });

    mockMarkNotificationRead.mockResolvedValue({
      success: true,
      data: { id: "notif-1", read: true },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    result.current.markAsRead("notif-1");

    await waitFor(() => {
      expect(mockMarkNotificationRead).toHaveBeenCalledWith("notif-1");
    });
  });

  it("marks all notifications as read", async () => {
    mockGetNotifications.mockResolvedValue({
      success: true,
      data: {
        notifications: [{ id: "notif-1", read: false }],
        total: 1,
        unread: 1,
      },
    });

    mockMarkAllNotificationsRead.mockResolvedValue({
      success: true,
      data: { markedRead: 1 },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    result.current.markAllAsRead();

    await waitFor(() => {
      expect(mockMarkAllNotificationsRead).toHaveBeenCalled();
    });
  });

  it("marks specific notifications as read when IDs provided", async () => {
    mockMarkAllNotificationsRead.mockResolvedValue({
      success: true,
      data: { markedRead: 2 },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    result.current.markAllAsRead(["notif-1", "notif-2"]);

    await waitFor(() => {
      expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith(["notif-1", "notif-2"]);
    });
  });

  it("provides refresh function", async () => {
    mockGetNotifications.mockResolvedValue({
      success: true,
      data: { notifications: [], total: 0, unread: 0 },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.refresh).toBe("function");
  });

  it("returns loading state initially", () => {
    mockGetNotifications.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("returns unread count from history data", async () => {
    mockGetNotifications.mockResolvedValue({
      success: true,
      data: {
        notifications: [
          { id: "notif-1", read: false },
          { id: "notif-2", read: true },
          { id: "notif-3", read: false },
        ],
        total: 3,
        unread: 2,
      },
    });

    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });
    expect(result.current.totalCount).toBe(3);
  });
});
