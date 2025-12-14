/**
 * Optimistic Update System
 * 
 * P1 GAP FIX: Provides optimistic UI updates with automatic rollback
 * 
 * Implements:
 * - Optimistic state tracking
 * - Automatic rollback on failure
 * - Conflict resolution
 * - Pending state management
 */

import { logger } from '../logger';

/**
 * Optimistic update status
 */
export type OptimisticStatus = 'pending' | 'confirmed' | 'failed' | 'rolled_back';

/**
 * Optimistic update interface
 */
export interface OptimisticUpdate<T> {
  id: string;
  key: string;
  optimisticValue: T;
  previousValue: T;
  confirmedValue?: T;
  status: OptimisticStatus;
  timestamp: number;
  rollback: () => void;
  confirm: (value?: T) => void;
  fail: (error: Error) => void;
}

/**
 * Optimistic update options
 */
export interface OptimisticUpdateOptions {
  /** Timeout in ms before auto-rollback (default: 5000) */
  timeout?: number;
  /** Callback when update is confirmed */
  onConfirm?: () => void;
  /** Callback when update fails */
  onFail?: (error: Error) => void;
  /** Callback when update is rolled back */
  onRollback?: () => void;
}

/**
 * Optimistic Update Manager
 * 
 * Manages optimistic UI updates with automatic rollback on failure
 */
export class OptimisticUpdateManager {
  private updates: Map<string, OptimisticUpdate<any>>;
  private timeouts: Map<string, NodeJS.Timeout>;
  private stateGetter: (key: string) => any;
  private stateSetter: (key: string, value: any) => void;

  constructor(
    stateGetter: (key: string) => any,
    stateSetter: (key: string, value: any) => void
  ) {
    this.updates = new Map();
    this.timeouts = new Map();
    this.stateGetter = stateGetter;
    this.stateSetter = stateSetter;
  }

  /**
   * Create optimistic update
   * 
   * Immediately updates state and returns update handle for confirmation/rollback
   */
  createUpdate<T>(
    key: string,
    optimisticValue: T,
    options: OptimisticUpdateOptions = {}
  ): OptimisticUpdate<T> {
    const id = `${key}-${Date.now()}-${Math.random()}`;
    const previousValue = this.stateGetter(key);
    const timeout = options.timeout || 5000;

    // Immediately apply optimistic value
    this.stateSetter(key, optimisticValue);

    // Create update object
    const update: OptimisticUpdate<T> = {
      id,
      key,
      optimisticValue,
      previousValue,
      status: 'pending',
      timestamp: Date.now(),
      
      rollback: () => {
        this.rollbackUpdate(id);
        options.onRollback?.();
      },
      
      confirm: (confirmedValue?: T) => {
        this.confirmUpdate(id, confirmedValue);
        options.onConfirm?.();
      },
      
      fail: (error: Error) => {
        this.failUpdate(id, error);
        options.onFail?.(error);
      }
    };

    // Store update
    this.updates.set(id, update);

    // Set auto-rollback timeout
    const timeoutId = setTimeout(() => {
      if (this.updates.has(id)) {
        logger.warn('Optimistic update timed out, rolling back', {
          id,
          key,
          timeout
        });
        update.rollback();
      }
    }, timeout);
    this.timeouts.set(id, timeoutId);

    logger.info('Optimistic update created', {
      id,
      key,
      timeout
    });

    return update;
  }

  /**
   * Confirm optimistic update
   * 
   * Marks update as confirmed and applies final value if provided
   */
  private confirmUpdate<T>(id: string, confirmedValue?: T): void {
    const update = this.updates.get(id);
    if (!update) {
      logger.warn('Cannot confirm unknown update', { id });
      return;
    }

    // Clear timeout
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }

    // Update status
    update.status = 'confirmed';
    update.confirmedValue = confirmedValue;

    // Apply confirmed value if different from optimistic
    if (confirmedValue !== undefined && confirmedValue !== update.optimisticValue) {
      this.stateSetter(update.key, confirmedValue);
      
      logger.info('Optimistic update confirmed with different value', {
        id,
        key: update.key,
        optimisticValue: update.optimisticValue,
        confirmedValue
      });
    } else {
      logger.info('Optimistic update confirmed', {
        id,
        key: update.key
      });
    }

    // Keep update in history for a short time
    setTimeout(() => {
      this.updates.delete(id);
    }, 1000);
  }

  /**
   * Fail optimistic update
   * 
   * Rolls back to previous value and marks as failed
   */
  private failUpdate(id: string, error: Error): void {
    const update = this.updates.get(id);
    if (!update) {
      logger.warn('Cannot fail unknown update', { id });
      return;
    }

    // Clear timeout
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }

    // Rollback to previous value
    this.stateSetter(update.key, update.previousValue);

    // Update status
    update.status = 'failed';

    logger.error('Optimistic update failed, rolled back', {
      id,
      key: update.key,
      error: error.message
    });

    // Keep update in history for debugging
    setTimeout(() => {
      this.updates.delete(id);
    }, 5000);
  }

  /**
   * Rollback optimistic update
   * 
   * Manually rolls back to previous value
   */
  private rollbackUpdate(id: string): void {
    const update = this.updates.get(id);
    if (!update) {
      logger.warn('Cannot rollback unknown update', { id });
      return;
    }

    // Clear timeout
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }

    // Rollback to previous value
    this.stateSetter(update.key, update.previousValue);

    // Update status
    update.status = 'rolled_back';

    logger.info('Optimistic update rolled back', {
      id,
      key: update.key
    });

    // Remove update
    this.updates.delete(id);
  }

  /**
   * Get pending updates for a key
   */
  getPendingUpdates(key: string): OptimisticUpdate<any>[] {
    return Array.from(this.updates.values())
      .filter(u => u.key === key && u.status === 'pending');
  }

  /**
   * Check if key has pending updates
   */
  hasPendingUpdates(key: string): boolean {
    return this.getPendingUpdates(key).length > 0;
  }

  /**
   * Get all pending updates
   */
  getAllPendingUpdates(): OptimisticUpdate<any>[] {
    return Array.from(this.updates.values())
      .filter(u => u.status === 'pending');
  }

  /**
   * Clear all updates (for testing)
   */
  clear(): void {
    // Clear all timeouts
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
    this.updates.clear();
  }

  /**
   * Get update statistics
   */
  getStats(): {
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    rolledBack: number;
  } {
    const updates = Array.from(this.updates.values());
    return {
      total: updates.length,
      pending: updates.filter(u => u.status === 'pending').length,
      confirmed: updates.filter(u => u.status === 'confirmed').length,
      failed: updates.filter(u => u.status === 'failed').length,
      rolledBack: updates.filter(u => u.status === 'rolled_back').length
    };
  }
}

/**
 * Helper function to create optimistic update with automatic server sync
 * 
 * Usage:
 * ```typescript
 * const update = await withOptimisticUpdate(
 *   stateManager,
 *   'user.name',
 *   'New Name',
 *   async () => {
 *     return await api.updateUser({ name: 'New Name' });
 *   }
 * );
 * ```
 */
export async function withOptimisticUpdate<T>(
  manager: OptimisticUpdateManager,
  key: string,
  optimisticValue: T,
  serverUpdate: () => Promise<T>,
  options: OptimisticUpdateOptions = {}
): Promise<T> {
  const update = manager.createUpdate(key, optimisticValue, options);

  try {
    const confirmedValue = await serverUpdate();
    update.confirm(confirmedValue);
    return confirmedValue;
  } catch (error) {
    update.fail(error as Error);
    throw error;
  }
}
