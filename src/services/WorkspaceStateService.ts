/**
 * Workspace State Service
 * 
 * Manages workspace state on the server and syncs to clients.
 * Provides centralized state management for SDUI workspaces.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { WorkspaceState } from '../types/sdui-integration';
import { LifecycleStage } from '../types/workflow';
import { CacheService } from './CacheService';
import { EventEmitter } from 'events';

/**
 * State change callback
 */
export type StateChangeCallback = (state: WorkspaceState) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Workspace State Service
 */
export class WorkspaceStateService extends EventEmitter {
  private cacheService: CacheService;
  private readonly CACHE_PREFIX = 'workspace:state:';
  private readonly CACHE_TTL = 300; // 5 minutes
  private subscriptions: Map<string, Set<StateChangeCallback>>;
  private stateVersions: Map<string, number>;

  constructor(cacheService?: CacheService) {
    super();
    this.cacheService = cacheService || new CacheService();
    this.subscriptions = new Map();
    this.stateVersions = new Map();
  }

  /**
   * Get current workspace state
   */
  async getState(workspaceId: string): Promise<WorkspaceState> {
    logger.info('Getting workspace state', { workspaceId });

    try {
      // Check cache first
      const cached = this.getCachedState(workspaceId);
      if (cached) {
        logger.debug('Returning cached workspace state', { workspaceId });
        return cached;
      }

      // Load from database
      const state = await this.loadStateFromDatabase(workspaceId);

      // Cache the state
      this.cacheState(workspaceId, state);

      logger.info('Loaded workspace state', {
        workspaceId,
        lifecycleStage: state.lifecycleStage,
        version: state.version,
      });

      return state;
    } catch (error) {
      logger.error('Failed to get workspace state', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default state on error
      return this.getDefaultState(workspaceId);
    }
  }

  /**
   * Update workspace state
   */
  async updateState(
    workspaceId: string,
    updates: Partial<WorkspaceState>
  ): Promise<WorkspaceState> {
    logger.info('Updating workspace state', {
      workspaceId,
      updates: Object.keys(updates),
    });

    try {
      // Get current state
      const currentState = await this.getState(workspaceId);

      // Increment version
      const newVersion = currentState.version + 1;

      // Merge updates
      const newState: WorkspaceState = {
        ...currentState,
        ...updates,
        version: newVersion,
        lastUpdated: Date.now(),
      };

      // Validate state
      this.validateState(newState);

      // Persist to database
      await this.persistState(workspaceId, newState);

      // Update cache
      this.cacheState(workspaceId, newState);

      // Update version tracking
      this.stateVersions.set(workspaceId, newVersion);

      // Notify subscribers
      this.notifySubscribers(workspaceId, newState);

      // Emit event
      this.emit('state:updated', { workspaceId, state: newState });

      logger.info('Workspace state updated', {
        workspaceId,
        version: newVersion,
      });

      return newState;
    } catch (error) {
      logger.error('Failed to update workspace state', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribeToChanges(
    workspaceId: string,
    callback: StateChangeCallback
  ): Unsubscribe {
    logger.debug('Subscribing to workspace state changes', { workspaceId });

    if (!this.subscriptions.has(workspaceId)) {
      this.subscriptions.set(workspaceId, new Set());
    }

    this.subscriptions.get(workspaceId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(workspaceId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(workspaceId);
        }
      }
      logger.debug('Unsubscribed from workspace state changes', { workspaceId });
    };
  }

  /**
   * Persist state to database
   */
  async persistState(workspaceId: string, state?: WorkspaceState): Promise<void> {
    logger.info('Persisting workspace state', { workspaceId });

    try {
      const stateToSave = state || (await this.getState(workspaceId));

      // Upsert to workspace_state table
      const { error } = await supabase
        .from('workspace_state')
        .upsert({
          workspace_id: workspaceId,
          lifecycle_stage: stateToSave.lifecycleStage,
          current_workflow_id: stateToSave.currentWorkflowId,
          current_stage_id: stateToSave.currentStageId,
          data: stateToSave.data,
          metadata: stateToSave.metadata,
          version: stateToSave.version,
          last_updated: new Date(stateToSave.lastUpdated).toISOString(),
        });

      if (error) {
        throw error;
      }

      logger.info('Workspace state persisted', {
        workspaceId,
        version: stateToSave.version,
      });
    } catch (error) {
      logger.error('Failed to persist workspace state', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get cached state
   */
  private getCachedState(workspaceId: string): WorkspaceState | null {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${workspaceId}`;
      return this.cacheService.get<WorkspaceState>(cacheKey);
    } catch (error) {
      logger.error('Failed to get cached state', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache state
   */
  private cacheState(workspaceId: string, state: WorkspaceState): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${workspaceId}`;
      this.cacheService.set(cacheKey, state, this.CACHE_TTL);
      logger.debug('Cached workspace state', { workspaceId });
    } catch (error) {
      logger.error('Failed to cache state', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Invalidate cache
   */
  invalidateCache(workspaceId: string): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${workspaceId}`;
      this.cacheService.delete(cacheKey);
      logger.debug('Invalidated workspace state cache', { workspaceId });
    } catch (error) {
      logger.error('Failed to invalidate cache', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load state from database
   */
  private async loadStateFromDatabase(workspaceId: string): Promise<WorkspaceState> {
    try {
      const { data, error } = await supabase
        .from('workspace_state')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        // No state exists, return default
        return this.getDefaultState(workspaceId);
      }

      // Convert database record to WorkspaceState
      const state: WorkspaceState = {
        workspaceId: data.workspace_id,
        lifecycleStage: data.lifecycle_stage as LifecycleStage,
        currentWorkflowId: data.current_workflow_id,
        currentStageId: data.current_stage_id,
        data: data.data || {},
        metadata: data.metadata || {},
        lastUpdated: new Date(data.last_updated).getTime(),
        version: data.version || 1,
      };

      return state;
    } catch (error) {
      logger.error('Failed to load state from database', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultState(workspaceId);
    }
  }

  /**
   * Get default state
   */
  private getDefaultState(workspaceId: string): WorkspaceState {
    return {
      workspaceId,
      lifecycleStage: 'opportunity',
      data: {},
      metadata: {},
      lastUpdated: Date.now(),
      version: 1,
    };
  }

  /**
   * Validate state
   */
  private validateState(state: WorkspaceState): void {
    if (!state.workspaceId) {
      throw new Error('Workspace ID is required');
    }

    if (!state.lifecycleStage) {
      throw new Error('Lifecycle stage is required');
    }

    const validStages: LifecycleStage[] = [
      'opportunity',
      'target',
      'expansion',
      'integrity',
      'realization',
    ];

    if (!validStages.includes(state.lifecycleStage)) {
      throw new Error(`Invalid lifecycle stage: ${state.lifecycleStage}`);
    }

    if (state.version < 1) {
      throw new Error('Version must be >= 1');
    }
  }

  /**
   * Notify subscribers of state change
   */
  private notifySubscribers(workspaceId: string, state: WorkspaceState): void {
    const callbacks = this.subscriptions.get(workspaceId);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(state);
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
   * Get current version
   */
  getCurrentVersion(workspaceId: string): number {
    return this.stateVersions.get(workspaceId) || 1;
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    logger.info('Cleared all workspace state subscriptions');
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(workspaceId: string): number {
    return this.subscriptions.get(workspaceId)?.size || 0;
  }
}

// Singleton instance
export const workspaceStateService = new WorkspaceStateService();
