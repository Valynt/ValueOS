/**
 * Realtime Update Service
 * 
 * Manages real-time SDUI updates via WebSocket.
 * Handles push notifications, conflict resolution, and state synchronization.
 */

import { logger } from '../lib/logger';
import { SDUIUpdate } from '../types/sdui-integration';
import { WebSocketManager, WebSocketMessage } from './WebSocketManager';
import { workspaceStateService } from './WorkspaceStateService';
import { EventEmitter } from 'events';

/**
 * Update subscription
 */
export interface UpdateSubscription {
  workspaceId: string;
  callback: (update: SDUIUpdate) => void;
  unsubscribe: () => void;
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy =
  | 'last_write_wins'
  | 'first_write_wins'
  | 'merge'
  | 'manual';

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  resolved: any;
  localChanges: any;
  remoteChanges: any;
  conflicts: string[];
}

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Realtime Update Service
 */
export class RealtimeUpdateService extends EventEmitter {
  private wsManager: WebSocketManager;
  private subscriptions: Map<string, Set<(update: SDUIUpdate) => void>>;
  private connected: boolean = false;
  private workspaceId: string | null = null;
  private userId: string | null = null;
  private conflictResolutionStrategy: ConflictResolutionStrategy = 'last_write_wins';

  constructor(wsManager?: WebSocketManager) {
    super();
    this.wsManager = wsManager || new WebSocketManager();
    this.subscriptions = new Map();
    this.setupEventHandlers();
  }

  /**
   * Connect to realtime updates
   */
  async connect(workspaceId: string, userId: string): Promise<void> {
    logger.info('Connecting to realtime updates', { workspaceId, userId });

    this.workspaceId = workspaceId;
    this.userId = userId;

    try {
      await this.wsManager.connect({
        url: this.getWebSocketUrl(),
        workspaceId,
        userId,
        reconnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
      });

      this.connected = true;
      this.emit('connected', { workspaceId, userId });

      logger.info('Connected to realtime updates', { workspaceId });
    } catch (error) {
      logger.error('Failed to connect to realtime updates', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Disconnect from realtime updates
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from realtime updates');

    await this.wsManager.disconnect();
    this.connected = false;
    this.workspaceId = null;
    this.userId = null;

    this.emit('disconnected');
  }

  /**
   * Push update to workspace
   */
  async pushUpdate(workspaceId: string, update: SDUIUpdate): Promise<void> {
    logger.info('Pushing update', {
      workspaceId,
      updateType: update.type,
      source: update.source,
    });

    try {
      const message: WebSocketMessage = {
        type: 'sdui_update',
        payload: {
          workspaceId,
          update,
        },
        timestamp: Date.now(),
        messageId: this.generateMessageId(),
      };

      await this.wsManager.send(message);

      logger.info('Update pushed', { workspaceId, messageId: message.messageId });
    } catch (error) {
      logger.error('Failed to push update', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Subscribe to updates
   */
  onUpdate(callback: (update: SDUIUpdate) => void): Unsubscribe {
    if (!this.workspaceId) {
      throw new Error('Not connected to any workspace');
    }

    const workspaceId = this.workspaceId;

    if (!this.subscriptions.has(workspaceId)) {
      this.subscriptions.set(workspaceId, new Set());
    }

    this.subscriptions.get(workspaceId)!.add(callback);

    logger.debug('Subscribed to updates', { workspaceId });

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(workspaceId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(workspaceId);
        }
      }
      logger.debug('Unsubscribed from updates', { workspaceId });
    };
  }

  /**
   * Resolve conflict between local and remote changes
   */
  async resolveConflict(
    localVersion: number,
    remoteVersion: number,
    localChanges: any,
    remoteChanges: any
  ): Promise<ConflictResolution> {
    logger.info('Resolving conflict', {
      localVersion,
      remoteVersion,
      strategy: this.conflictResolutionStrategy,
    });

    const conflicts: string[] = [];

    // Detect conflicts
    if (localChanges && remoteChanges) {
      for (const key of Object.keys(localChanges)) {
        if (key in remoteChanges && localChanges[key] !== remoteChanges[key]) {
          conflicts.push(key);
        }
      }
    }

    let resolved: any;

    switch (this.conflictResolutionStrategy) {
      case 'last_write_wins':
        // Remote changes win (they're newer)
        resolved = { ...localChanges, ...remoteChanges };
        break;

      case 'first_write_wins':
        // Local changes win (they were first)
        resolved = { ...remoteChanges, ...localChanges };
        break;

      case 'merge':
        // Attempt intelligent merge
        resolved = this.mergeChanges(localChanges, remoteChanges);
        break;

      case 'manual':
        // Require manual resolution
        throw new Error('Manual conflict resolution required');

      default:
        resolved = { ...localChanges, ...remoteChanges };
    }

    const resolution: ConflictResolution = {
      strategy: this.conflictResolutionStrategy,
      resolved,
      localChanges,
      remoteChanges,
      conflicts,
    };

    logger.info('Conflict resolved', {
      strategy: this.conflictResolutionStrategy,
      conflictCount: conflicts.length,
    });

    return resolution;
  }

  /**
   * Set conflict resolution strategy
   */
  setConflictResolutionStrategy(strategy: ConflictResolutionStrategy): void {
    this.conflictResolutionStrategy = strategy;
    logger.info('Conflict resolution strategy set', { strategy });
  }

  /**
   * Is connected
   */
  isConnected(): boolean {
    return this.connected && this.wsManager.isConnected();
  }

  /**
   * Get current workspace ID
   */
  getCurrentWorkspaceId(): string | null {
    return this.workspaceId;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming SDUI updates
    this.wsManager.on('sdui_update', (payload: any) => {
      this.handleIncomingUpdate(payload);
    });

    // Handle connection state changes
    this.wsManager.on('state_change', (event: any) => {
      this.emit('connection_state_change', event);
    });

    // Handle max reconnect attempts
    this.wsManager.on('max_reconnect_attempts', () => {
      this.emit('connection_failed');
    });
  }

  /**
   * Handle incoming update
   */
  private async handleIncomingUpdate(payload: any): Promise<void> {
    const { workspaceId, update } = payload;

    logger.info('Received update', {
      workspaceId,
      updateType: update.type,
      source: update.source,
    });

    try {
      // Check for conflicts
      const currentState = await workspaceStateService.getState(workspaceId);
      const hasConflict = this.detectConflict(currentState, update);

      if (hasConflict) {
        logger.warn('Conflict detected', { workspaceId });
        // TODO: Implement conflict resolution
      }

      // Notify subscribers
      this.notifySubscribers(workspaceId, update);

      // Emit event
      this.emit('update_received', { workspaceId, update });
    } catch (error) {
      logger.error('Failed to handle incoming update', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(workspaceId: string, update: SDUIUpdate): void {
    const callbacks = this.subscriptions.get(workspaceId);

    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(update);
        } catch (error) {
          logger.error('Subscriber callback failed', {
            workspaceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }
  }

  /**
   * Detect conflict
   */
  private detectConflict(currentState: any, update: SDUIUpdate): boolean {
    // Simple version-based conflict detection
    // In production, this would be more sophisticated
    return false;
  }

  /**
   * Merge changes intelligently
   */
  private mergeChanges(localChanges: any, remoteChanges: any): any {
    // Simple merge - in production, this would be more sophisticated
    const merged = { ...localChanges };

    for (const [key, value] of Object.entries(remoteChanges)) {
      if (!(key in localChanges)) {
        // No conflict, add remote change
        merged[key] = value;
      } else if (Array.isArray(value) && Array.isArray(localChanges[key])) {
        // Merge arrays
        merged[key] = [...new Set([...localChanges[key], ...value])];
      } else if (typeof value === 'object' && typeof localChanges[key] === 'object') {
        // Recursively merge objects
        merged[key] = this.mergeChanges(localChanges[key], value);
      }
      // Otherwise, keep local change (conflict)
    }

    return merged;
  }

  /**
   * Get WebSocket URL
   */
  private getWebSocketUrl(): string {
    // In production, this would come from configuration
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/sdui`;
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const realtimeUpdateService = new RealtimeUpdateService();
