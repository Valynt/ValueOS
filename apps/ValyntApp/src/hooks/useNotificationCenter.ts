/**
 * Smart Notification Center - Frontend Hook
 *
 * Uses SSE for real-time notifications with fallback to polling.
 * Covers: connection management, notification history, mark as read.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api, apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | "agent_complete"
  | "validation_result"
  | "workflow_transition"
  | "confidence_update"
  | "hypothesis_promoted"
  | "scenario_recalculated"
  | "board_ready_available"
  | "approval_required";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  caseId?: string;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  isConnected: boolean;
  connectionError: string | null;
}

// ============================================================================
// Notification Center Hook
// ============================================================================

/**
 * Smart Notification Center with SSE real-time updates
 */
export function useNotificationCenter() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;
  const userId = user?.id;

  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch notification history
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["notifications", tenantId, userId],
    queryFn: async () => {
      const response = await api.getNotifications();
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch notifications");
      }
      return response.data as { notifications: Notification[]; total: number; unread: number };
    },
    enabled: !!tenantId && !!userId,
    staleTime: 30000,
  });

  // Mark as read mutation
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await api.markNotificationRead(notificationId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to mark as read");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", tenantId, userId] });
    },
  });

  // Mark all as read mutation
  const markAllAsRead = useMutation({
    mutationFn: async (notificationIds?: string[]) => {
      const response = await api.markAllNotificationsRead(notificationIds);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to mark all as read");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", tenantId, userId] });
    },
  });

  // SSE Connection
  useEffect(() => {
    if (!tenantId || !userId) return;

    const connect = () => {
      try {
        // Build SSE URL with auth token from apiClient
        const token = apiClient.getAuthToken?.() || localStorage.getItem("token");
        const sseUrl = `/api/notifications/stream${token ? `?token=${token}` : ""}`;

        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          setConnectionError(null);
          console.log("[Notifications] SSE connected");
        };

        eventSource.onmessage = (event) => {
          // Handle heartbeat (comments start with :)
          if (event.data.startsWith(":")) return;

          try {
            const data = JSON.parse(event.data);
            handleSseEvent(data);
          } catch (e) {
            console.warn("[Notifications] Failed to parse SSE message", e);
          }
        };

        eventSource.onerror = (error) => {
          console.error("[Notifications] SSE error", error);
          setIsConnected(false);
          setConnectionError("Connection lost. Retrying...");

          // Auto-reconnect after delay
          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              connect();
            }
          }, 5000);
        };
      } catch (error) {
        setConnectionError("Failed to connect to notification stream");
        console.error("[Notifications] Failed to create EventSource", error);
      }
    };

    const handleSseEvent = (data: { event?: string; [key: string]: unknown }) => {
      switch (data.event) {
        case "connected":
          console.log("[Notifications] Connected:", data);
          break;

        case "initial_batch":
          // Merge with existing notifications
          queryClient.setQueryData(
            ["notifications", tenantId, userId],
            (old: { notifications: Notification[]; total: number; unread: number } | undefined) => {
              const batch = (data.notifications as Notification[]) ?? [];
              const merged = [...batch, ...(old?.notifications ?? [])];
              // Remove duplicates
              const unique = merged.filter(
                (n, i, arr) => arr.findIndex((t) => t.id === n.id) === i
              );
              return {
                notifications: unique.slice(0, 50),
                total: unique.length,
                unread: unique.filter((n) => !n.read).length,
              };
            }
          );
          break;

        case "notification":
          // Add new notification
          queryClient.setQueryData(
            ["notifications", tenantId, userId],
            (old: { notifications: Notification[]; total: number; unread: number } | undefined) => {
              const newNotification = data as unknown as Notification;
              const updated = [newNotification, ...(old?.notifications ?? [])];
              return {
                notifications: updated.slice(0, 50),
                total: (old?.total ?? 0) + 1,
                unread: (old?.unread ?? 0) + 1,
              };
            }
          );
          break;

        default:
          console.log("[Notifications] Unknown event:", data);
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [tenantId, userId, queryClient]);

  // Manual refresh (fallback when SSE fails)
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications", tenantId, userId] });
  }, [queryClient, tenantId, userId]);

  return {
    notifications: historyData?.notifications ?? [],
    unreadCount: historyData?.unread ?? 0,
    totalCount: historyData?.total ?? 0,
    isConnected,
    connectionError,
    isLoading: isLoadingHistory,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    isMarkingRead: markAsRead.isPending || markAllAsRead.isPending,
    refresh,
  };
}

export default useNotificationCenter;
