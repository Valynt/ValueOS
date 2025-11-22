/**
 * Presence Service
 * Real-time collaboration indicators showing active users
 * 
 * SEC-003: Migrated to TenantAwareService for tenant isolation
 */

import { logger } from '../lib/logger';
import { TenantAwareService } from './TenantAwareService';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ActiveSession {
  id: string;
  userId: string;
  pagePath: string;
  action?: string;
  metadata?: Record<string, any>;
  lastHeartbeat: string;
  createdAt: string;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  userEmail: string;
  avatar?: string;
  action: string;
  lastSeen: string;
}

export class PresenceService extends TenantAwareService {
  private heartbeatInterval?: NodeJS.Timeout;
  private currentSessionId?: string;
  private realtimeChannel?: RealtimeChannel;

  constructor() {
    super('PresenceService');
  }

  /**
   * Start presence tracking for current user
   * SEC-003: Added tenant validation
   */
  async startPresence(
    userId: string,
    tenantId: string,
    pagePath: string,
    action: string = 'viewing',
    metadata: Record<string, any> = {}
  ): Promise<string> {
    this.log('info', 'Starting presence tracking', { userId, tenantId, pagePath, action });

    // SEC-003: Validate tenant access
    await this.validateTenantAccess(userId, tenantId);

    return this.executeRequest(
      async () => {
        // Create session with tenant_id
        const { data, error } = await this.supabase
          .from('active_sessions')
          .insert({
            user_id: userId,
            tenant_id: tenantId, // SEC-003: Always include tenant_id
            page_path: pagePath,
            action,
            metadata,
          })
          .select()
          .single();

        if (error) throw error;

        this.currentSessionId = data.id;

        // Start heartbeat
        this.startHeartbeat();

        return data.id;
      },
      { skipCache: true }
    );
  }

  /**
   * Update presence action (e.g., viewing -> editing)
   */
  async updatePresence(
    sessionId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.executeRequest(
      async () => {
        const updates: any = {
          action,
          last_heartbeat: new Date().toISOString(),
        };

        if (metadata) {
          updates.metadata = metadata;
        }

        const { error } = await this.supabase
          .from('active_sessions')
          .update(updates)
          .eq('id', sessionId);

        if (error) throw error;
      },
      { skipCache: true }
    );
  }

  /**
   * End presence tracking
   */
  async endPresence(sessionId?: string): Promise<void> {
    const id = sessionId || this.currentSessionId;
    if (!id) return;

    this.log('info', 'Ending presence tracking', { sessionId: id });

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Unsubscribe from realtime
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = undefined;
    }

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from('active_sessions')
          .delete()
          .eq('id', id);

        if (error) throw error;

        this.currentSessionId = undefined;
      },
      { skipCache: true }
    );
  }

  /**
   * Get active users on a page
   */
  async getActiveUsers(pagePath: string): Promise<PresenceUser[]> {
    return this.executeRequest(
      async () => {
        // Get sessions active in last 30 seconds
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

        const { data, error } = await this.supabase
          .from('active_sessions')
          .select('*, users(id, full_name, email, avatar)')
          .eq('page_path', pagePath)
          .gte('last_heartbeat', thirtySecondsAgo);

        if (error) throw error;

        return (data || []).map((session) => ({
          userId: session.user_id,
          userName: session.users?.full_name || 'Unknown',
          userEmail: session.users?.email || '',
          avatar: session.users?.avatar,
          action: session.action || 'viewing',
          lastSeen: session.last_heartbeat,
        }));
      },
      {
        deduplicationKey: `active-users-${pagePath}`,
      }
    );
  }

  /**
   * Subscribe to presence updates on a page
   */
  subscribeToPresence(
    pagePath: string,
    onUpdate: (users: PresenceUser[]) => void
  ): () => void {
    this.log('info', 'Subscribing to presence updates', { pagePath });

    // Subscribe to realtime changes
    this.realtimeChannel = this.supabase
      .channel(`presence:${pagePath}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_sessions',
          filter: `page_path=eq.${pagePath}`,
        },
        () => {
          // Refresh active users
          this.getActiveUsers(pagePath).then(onUpdate);
        }
      )
      .subscribe();

    // Initial load
    this.getActiveUsers(pagePath).then(onUpdate);

    // Return unsubscribe function
    return () => {
      if (this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = undefined;
      }
    };
  }

  /**
   * Detect edit conflicts
   */
  async detectConflicts(
    pagePath: string,
    currentUserId: string
  ): Promise<{
    hasConflict: boolean;
    editingUsers: PresenceUser[];
  }> {
    const activeUsers = await this.getActiveUsers(pagePath);

    const editingUsers = activeUsers.filter(
      (user) => user.action === 'editing' && user.userId !== currentUserId
    );

    return {
      hasConflict: editingUsers.length > 0,
      editingUsers,
    };
  }

  /**
   * Clean up stale sessions
   */
  async cleanupStaleSessions(): Promise<number> {
    this.log('info', 'Cleaning up stale sessions');

    return this.executeRequest(
      async () => {
        // Remove sessions inactive for more than 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data, error } = await this.supabase
          .from('active_sessions')
          .delete()
          .lt('last_heartbeat', fiveMinutesAgo)
          .select('id');

        if (error) throw error;

        const deletedCount = data?.length || 0;
        this.log('info', `Cleaned up ${deletedCount} stale sessions`);

        return deletedCount;
      },
      { skipCache: true }
    );
  }

  /**
   * Send heartbeat to keep session alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(
      async () => {
        if (this.currentSessionId) {
          try {
            await this.supabase
              .from('active_sessions')
              .update({ last_heartbeat: new Date().toISOString() })
              .eq('id', this.currentSessionId);
          } catch (error) {
            this.log('error', 'Heartbeat failed', { error });
          }
        }
      },
      15000 // Every 15 seconds
    );
  }
}

export const presenceService = new PresenceService();
