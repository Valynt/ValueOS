/**
 * Supabase Realtime Service
 * 
 * Manages real-time connections, presence, and collaborative features
 * using Supabase Realtime infrastructure.
 */

import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { logger } from '../logger';

// Presence user interface
export interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  cursorX?: number;
  cursorY?: number;
  selectedElementId?: string;
  status: 'active' | 'idle' | 'away';
  lastSeen: string;
}

// Canvas element interface
export interface CanvasElement {
  id: string;
  valueCaseId: string;
  elementType: 'text' | 'shape' | 'connector' | 'sticky_note' | 'image';
  positionX: number;
  positionY: number;
  width?: number;
  height?: number;
  content: Record<string, any>;
  style?: Record<string, any>;
  zIndex: number;
  locked: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Comment interface
export interface CanvasComment {
  id: string;
  valueCaseId: string;
  elementId?: string;
  parentCommentId?: string;
  userId: string;
  userName: string;
  content: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Realtime event types
export type RealtimeEventType = 
  | 'element_created'
  | 'element_updated'
  | 'element_deleted'
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted'
  | 'presence_join'
  | 'presence_leave'
  | 'presence_update'
  | 'cursor_move';

// Event payload interface
export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  payload: T;
  userId: string;
  timestamp: string;
}

// Subscription callback types
export type ElementCallback = (element: CanvasElement, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
export type CommentCallback = (comment: CanvasComment, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
export type PresenceCallback = (users: PresenceUser[]) => void;
export type BroadcastCallback = (event: RealtimeEvent) => void;

class SupabaseRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Create or get a channel for a value case
   */
  private getChannel(valueCaseId: string, channelType: 'canvas' | 'presence' | 'comments'): RealtimeChannel {
    const channelName = `${channelType}:${valueCaseId}`;
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: channelType === 'presence' ? 'user_id' : undefined },
      },
    });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Subscribe to canvas element changes
   */
  public subscribeToElements(
    valueCaseId: string,
    callback: ElementCallback
  ): () => void {
    const channel = this.getChannel(valueCaseId, 'canvas');

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canvas_elements',
          filter: `value_case_id=eq.${valueCaseId}`,
        },
        (payload) => {
          logger.debug('Canvas element change', payload);

          const element = this.mapDatabaseToElement(payload.new as any);
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';

          callback(element, event);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to canvas elements', { valueCaseId });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Canvas subscription error', new Error('Channel error'));
          this.handleReconnect(valueCaseId, 'canvas');
        }
      });

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      this.channels.delete(`canvas:${valueCaseId}`);
    };
  }

  /**
   * Subscribe to comments
   */
  public subscribeToComments(
    valueCaseId: string,
    callback: CommentCallback
  ): () => void {
    const channel = this.getChannel(valueCaseId, 'comments');

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canvas_comments',
          filter: `value_case_id=eq.${valueCaseId}`,
        },
        (payload) => {
          logger.debug('Comment change', payload);

          const comment = this.mapDatabaseToComment(payload.new as any);
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';

          callback(comment, event);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to comments', { valueCaseId });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Comments subscription error', new Error('Channel error'));
          this.handleReconnect(valueCaseId, 'comments');
        }
      });

    return () => {
      channel.unsubscribe();
      this.channels.delete(`comments:${valueCaseId}`);
    };
  }

  /**
   * Subscribe to presence (active users)
   */
  public subscribeToPresence(
    valueCaseId: string,
    currentUser: PresenceUser,
    callback: PresenceCallback
  ): () => void {
    const channel = this.getChannel(valueCaseId, 'presence');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = this.parsePresenceState(state);
        callback(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        logger.debug('User joined', { key, newPresences });
        const state = channel.presenceState();
        const users = this.parsePresenceState(state);
        callback(users);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        logger.debug('User left', { key, leftPresences });
        const state = channel.presenceState();
        const users = this.parsePresenceState(state);
        callback(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Subscribed to presence', { valueCaseId });
          
          // Track presence in channel
          await channel.track(currentUser);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Presence subscription error', new Error('Channel error'));
          this.handleReconnect(valueCaseId, 'presence');
        }
      });

    return () => {
      channel.untrack();
      channel.unsubscribe();
      this.channels.delete(`presence:${valueCaseId}`);
    };
  }

  /**
   * Update presence (cursor position, selected element, etc.)
   */
  public async updatePresence(
    valueCaseId: string,
    updates: Partial<PresenceUser>
  ): Promise<void> {
    const channel = this.channels.get(`presence:${valueCaseId}`);
    
    if (!channel) {
      logger.warn('Cannot update presence: channel not found', { valueCaseId });
      return;
    }

    try {
      await channel.track(updates);
    } catch (error) {
      logger.error('Failed to update presence', error as Error);
    }
  }

  /**
   * Broadcast an event to all users
   */
  public async broadcast(
    valueCaseId: string,
    event: RealtimeEvent
  ): Promise<void> {
    const channel = this.channels.get(`canvas:${valueCaseId}`);
    
    if (!channel) {
      logger.warn('Cannot broadcast: channel not found', { valueCaseId });
      return;
    }

    try {
      await channel.send({
        type: 'broadcast',
        event: event.type,
        payload: event.payload,
      });
    } catch (error) {
      logger.error('Failed to broadcast event', error as Error);
    }
  }

  /**
   * Subscribe to broadcast events
   */
  public subscribeToBroadcast(
    valueCaseId: string,
    callback: BroadcastCallback
  ): () => void {
    const channel = this.getChannel(valueCaseId, 'canvas');

    channel
      .on('broadcast', { event: '*' }, (payload) => {
        logger.debug('Broadcast received', payload);
        callback(payload as RealtimeEvent);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Parse presence state into user array
   */
  private parsePresenceState(state: RealtimePresenceState): PresenceUser[] {
    const users: PresenceUser[] = [];

    Object.keys(state).forEach((key) => {
      const presences = state[key];
      presences.forEach((presence: any) => {
        users.push({
          userId: presence.userId,
          userName: presence.userName,
          userEmail: presence.userEmail,
          cursorX: presence.cursorX,
          cursorY: presence.cursorY,
          selectedElementId: presence.selectedElementId,
          status: presence.status || 'active',
          lastSeen: presence.lastSeen || new Date().toISOString(),
        });
      });
    });

    return users;
  }

  /**
   * Map database row to CanvasElement
   */
  private mapDatabaseToElement(row: any): CanvasElement {
    return {
      id: row.id,
      valueCaseId: row.value_case_id,
      elementType: row.element_type,
      positionX: row.position_x,
      positionY: row.position_y,
      width: row.width,
      height: row.height,
      content: row.content,
      style: row.style,
      zIndex: row.z_index,
      locked: row.locked,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to CanvasComment
   */
  private mapDatabaseToComment(row: any): CanvasComment {
    return {
      id: row.id,
      valueCaseId: row.value_case_id,
      elementId: row.element_id,
      parentCommentId: row.parent_comment_id,
      userId: row.user_id,
      userName: row.user_name,
      content: row.content,
      resolved: row.resolved,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnect(
    valueCaseId: string,
    channelType: 'canvas' | 'presence' | 'comments'
  ): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached', new Error('Connection failed'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.info('Attempting to reconnect', {
      valueCaseId,
      channelType,
      attempt: this.reconnectAttempts,
      delay,
    });

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Remove old channel
    const channelName = `${channelType}:${valueCaseId}`;
    const oldChannel = this.channels.get(channelName);
    if (oldChannel) {
      await oldChannel.unsubscribe();
      this.channels.delete(channelName);
    }

    // Reconnection will happen on next subscription
  }

  /**
   * Cleanup all channels
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up realtime channels', {
      count: this.channels.size,
    });

    const unsubscribePromises = Array.from(this.channels.values()).map((channel) =>
      channel.unsubscribe()
    );

    await Promise.all(unsubscribePromises);
    this.channels.clear();
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(valueCaseId: string, channelType: 'canvas' | 'presence' | 'comments'): string {
    const channelName = `${channelType}:${valueCaseId}`;
    const channel = this.channels.get(channelName);
    
    if (!channel) {
      return 'disconnected';
    }

    // Supabase channel state is not directly accessible, so we return a generic status
    return 'connected';
  }
}

// Singleton instance
let realtimeInstance: SupabaseRealtimeService | null = null;

/**
 * Get realtime service instance
 */
export function getRealtimeService(): SupabaseRealtimeService {
  if (!realtimeInstance) {
    realtimeInstance = new SupabaseRealtimeService();
  }
  return realtimeInstance;
}

// Export singleton instance getter
export default getRealtimeService;
