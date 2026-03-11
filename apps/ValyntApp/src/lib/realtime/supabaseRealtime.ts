/**
 * Supabase Realtime — canvas element sync, presence, and notification broadcast.
 *
 * Three subscription types:
 *   subscribeToElements       — postgres_changes on canvas_elements for a value case
 *   subscribeToPresence       — Supabase Presence for collaborative cursors
 *   subscribeToNotifications  — Broadcast channel `notifications:{orgId}` for
 *                               the wireframe NotificationProvider
 */

import { createBrowserSupabaseClient } from "../supabase";

// RealtimeService is browser-only — obtain the client lazily so SSR/test
// environments that never call createBrowserSupabaseClient() don't throw.
function getClient() {
  return createBrowserSupabaseClient();
}

// ============================================================================
// Types
// ============================================================================

export interface CanvasElement {
  id: string;
  valueCaseId: string;
  elementType: string;
  positionX: number;
  positionY: number;
  content: Record<string, unknown>;
  zIndex: number;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
  // Optional fields used by conflict-resolution tests and collaborative editing
  createdBy?: string;
  updatedBy?: string;
  width?: number;
  height?: number;
  style?: Record<string, unknown>;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  lastSeen: string;
  avatar?: string;
  // Optional cursor position for collaborative editing
  cursorX?: number;
  cursorY?: number;
}

export type ElementEvent = "INSERT" | "UPDATE" | "DELETE";

/** Shape broadcast by the backend NotificationService on notification.created */
export interface NotificationBroadcastPayload {
  id: string;
  organization_id: string;
  user_id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  source: string;
  action_label: string | null;
  action_route: string | null;
  read: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function rowToCanvasElement(row: Record<string, unknown>): CanvasElement {
  return {
    id: row.id as string,
    valueCaseId: row.value_case_id as string,
    elementType: row.element_type as string,
    positionX: row.position_x as number,
    positionY: row.position_y as number,
    content: (row.content as Record<string, unknown>) ?? {},
    zIndex: row.z_index as number,
    locked: row.locked as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================================
// RealtimeService
// ============================================================================

export class RealtimeService {
  // --------------------------------------------------------------------------
  // Canvas element subscriptions (postgres_changes)
  // --------------------------------------------------------------------------

  subscribeToElements(
    valueCaseId: string,
    callback: (element: CanvasElement, event: ElementEvent) => void
  ): () => void {
    const channelName = `canvas-elements:${valueCaseId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (getClient() as any).channel(channelName);
    channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvas_elements",
          filter: `value_case_id=eq.${valueCaseId}`,
        },
        (payload: Record<string, unknown>) => {
          const eventType = payload.eventType as ElementEvent;
          const row = (payload.new ?? payload.old) as Record<string, unknown>;
          if (row) {
            callback(rowToCanvasElement(row), eventType);
          }
        }
      )
      .subscribe();

    return () => {
      getClient().removeChannel(channel);
    };
  }

  // --------------------------------------------------------------------------
  // Presence subscriptions
  // --------------------------------------------------------------------------

  subscribeToPresence(
    valueCaseId: string,
    currentUser: PresenceUser,
    onUsersChange: (users: PresenceUser[]) => void
  ): { unsubscribe: () => void; channel: unknown } {
    const channelName = `presence:${valueCaseId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (getClient() as any).channel(channelName);
    channel
      .on("presence", { event: "sync" }, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = (channel as any).presenceState() as Record<string, PresenceUser[]>;
        const users = Object.values(state).flat();
        onUsersChange(users);
      })
      .on("presence", { event: "join" }, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = (channel as any).presenceState() as Record<string, PresenceUser[]>;
        const users = Object.values(state).flat();
        onUsersChange(users);
      })
      .on("presence", { event: "leave" }, () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = (channel as any).presenceState() as Record<string, PresenceUser[]>;
        const users = Object.values(state).flat();
        onUsersChange(users);
      })
      .subscribe();

    // Track presence immediately — the channel will buffer the track call
    // until the subscription is confirmed by the server.
    void channel.track(currentUser);

    return {
      channel,
      unsubscribe: () => {
        void channel.untrack();
        void channel.unsubscribe();
      },
    };
  }

  // --------------------------------------------------------------------------
  // Presence update (cursor position etc.)
  // --------------------------------------------------------------------------

  /**
   * Update the current user's presence state on an existing channel.
   *
   * Accepts the channel reference returned by subscribeToPresence rather than
   * a valueCaseId string. Supabase JS v2's getClient().channel(name) always
   * creates a new unsubscribed channel, so callers must pass the already-
   * subscribed channel reference to avoid a no-op track call.
   */
  async updatePresence(
    channel: unknown,
    update: Partial<PresenceUser>
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (channel as any).track(update);
    } catch {
      // Channel may not be subscribed yet — ignore
    }
  }

  // --------------------------------------------------------------------------
  // Notification broadcast subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to the `notifications:{organizationId}` Broadcast channel.
   * The backend NotificationService pushes `notification.created` events here
   * after inserting a row, so clients receive new notifications in real time
   * without polling.
   */
  subscribeToNotifications(
    organizationId: string,
    onNotification: (payload: NotificationBroadcastPayload) => void
  ): () => void {
    const channelName = `notifications:${organizationId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (getClient() as any)
      .channel(channelName)
      .on(
        "broadcast",
        { event: "notification.created" },
        ({ payload }: { payload: NotificationBroadcastPayload }) => {
          onNotification(payload);
        }
      )
      .subscribe();

    return () => {
      getClient().removeChannel(channel);
    };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async cleanup(): Promise<void> {
    await getClient().removeAllChannels();
  }
}

// Singleton
let _instance: RealtimeService | null = null;
export function getRealtimeService(): RealtimeService {
  if (!_instance) _instance = new RealtimeService();
  return _instance;
}

// ============================================================================
// Legacy exports — kept for backward compatibility with existing call sites
// ============================================================================

export interface RealtimeChannel {
  subscribe(): void;
  unsubscribe(): void;
  on(event: string, callback: (payload: unknown) => void): RealtimeChannel;
}

export function createRealtimeChannel(_name: string): RealtimeChannel {
  return {
    subscribe: () => {},
    unsubscribe: () => {},
    on: function () {
      return this;
    },
  };
}

export function subscribeToChanges(
  _table: string,
  _callback: (payload: unknown) => void
): () => void {
  return () => {};
}
