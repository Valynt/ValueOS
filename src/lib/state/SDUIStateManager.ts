/**
 * SDUI State Manager
 * 
 * Centralized state management for SDUI components with:
 * - In-memory cache for fast access
 * - Subscriber pattern for reactive updates
 * - Persistence to database
 * - Optimistic updates
 * - Conflict resolution
 */

import { logger } from '../logger';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * State change event
 */
export interface StateChangeEvent<T = any> {
  key: string;
  oldValue: T | null;
  newValue: T;
  timestamp: number;
  source: 'local' | 'remote' | 'initial';
}

/**
 * Subscriber callback
 */
export type StateSubscriber<T = any> = (event: StateChangeEvent<T>) => void;

/**
 * State entry with metadata
 */
interface StateEntry<T = any> {
  value: T;
  version: number;
  updatedAt: number;
  dirty: boolean;
}

/**
 * Persistence options
 */
export interface PersistenceOptions {
  /** Enable database persistence */
  enabled: boolean;
  /** Debounce time for writes (ms) */
  debounceMs: number;
  /** Table name for persistence */
  tableName: string;
  /** Session ID for scoping */
  sessionId?: string;
}

/**
 * SDUIStateManager Configuration
 */
export interface SDUIStateManagerConfig {
  /** Supabase client for persistence */
  supabase?: SupabaseClient;
  /** Persistence options */
  persistence?: Partial<PersistenceOptions>;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum cache size (number of entries) */
  maxCacheSize?: number;
}

/**
 * Default persistence options
 */
const DEFAULT_PERSISTENCE: PersistenceOptions = {
  enabled: false,
  debounceMs: 1000,
  tableName: 'sdui_state',
  sessionId: undefined
};

/**
 * SDUI State Manager
 * 
 * Manages state for SDUI components with caching, subscriptions, and persistence.
 */
export class SDUIStateManager {
  private cache: Map<string, StateEntry> = new Map();
  private subscribers: Map<string, Set<StateSubscriber>> = new Map();
  private globalSubscribers: Set<StateSubscriber> = new Set();
  private persistenceTimers: Map<string, NodeJS.Timeout> = new Map();
  private supabase?: SupabaseClient;
  private persistence: PersistenceOptions;
  private debug: boolean;
  private maxCacheSize: number;

  constructor(config: SDUIStateManagerConfig = {}) {
    this.supabase = config.supabase;
    this.persistence = { ...DEFAULT_PERSISTENCE, ...config.persistence };
    this.debug = config.debug || false;
    this.maxCacheSize = config.maxCacheSize || 1000;

    if (this.debug) {
      logger.debug('SDUIStateManager initialized', {
        persistence: this.persistence.enabled,
        maxCacheSize: this.maxCacheSize
      });
    }
  }

  /**
   * Get state value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      if (this.debug) {
        logger.debug('State cache miss', { key });
      }
      return null;
    }

    if (this.debug) {
      logger.debug('State cache hit', { key, version: entry.version });
    }

    return entry.value as T;
  }

  /**
   * Set state value
   */
  set<T>(key: string, value: T, options: { persist?: boolean; source?: 'local' | 'remote' } = {}): void {
    const oldEntry = this.cache.get(key);
    const oldValue = oldEntry?.value || null;
    const version = (oldEntry?.version || 0) + 1;

    // Create new entry
    const entry: StateEntry<T> = {
      value,
      version,
      updatedAt: Date.now(),
      dirty: options.persist !== false
    };

    // Update cache
    this.cache.set(key, entry);

    // Enforce cache size limit
    if (this.cache.size > this.maxCacheSize) {
      this.evictOldestEntry();
    }

    // Create change event
    const event: StateChangeEvent<T> = {
      key,
      oldValue,
      newValue: value,
      timestamp: entry.updatedAt,
      source: options.source || 'local'
    };

    // Notify subscribers
    this.notifySubscribers(key, event);

    // Schedule persistence
    if (this.persistence.enabled && entry.dirty && options.persist !== false) {
      this.schedulePersistence(key);
    }

    if (this.debug) {
      logger.debug('State updated', {
        key,
        version,
        hasOldValue: oldValue !== null,
        source: event.source
      });
    }
  }

  /**
   * Update state value (merge with existing)
   */
  update<T extends Record<string, any>>(key: string, partial: Partial<T>): void {
    const current = this.get<T>(key);
    if (!current) {
      throw new Error(`Cannot update non-existent state: ${key}`);
    }

    const updated = { ...current, ...partial };
    this.set(key, updated);
  }

  /**
   * Delete state value
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Remove from cache
    this.cache.delete(key);

    // Cancel pending persistence
    const timer = this.persistenceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.persistenceTimers.delete(key);
    }

    // Delete from database
    if (this.persistence.enabled) {
      this.deleteFromDatabase(key);
    }

    // Notify subscribers
    const event: StateChangeEvent = {
      key,
      oldValue: entry.value,
      newValue: null as any,
      timestamp: Date.now(),
      source: 'local'
    };
    this.notifySubscribers(key, event);

    if (this.debug) {
      logger.debug('State deleted', { key });
    }

    return true;
  }

  /**
   * Check if state exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all state
   */
  clear(): void {
    const keys = Array.from(this.cache.keys());
    
    // Clear cache
    this.cache.clear();

    // Cancel all pending persistence
    for (const timer of this.persistenceTimers.values()) {
      clearTimeout(timer);
    }
    this.persistenceTimers.clear();

    // Notify subscribers
    for (const key of keys) {
      const event: StateChangeEvent = {
        key,
        oldValue: null,
        newValue: null as any,
        timestamp: Date.now(),
        source: 'local'
      };
      this.notifySubscribers(key, event);
    }

    if (this.debug) {
      logger.debug('State cleared', { count: keys.length });
    }
  }

  /**
   * Subscribe to state changes for a specific key
   */
  subscribe<T>(key: string, callback: StateSubscriber<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key)!.add(callback as StateSubscriber);

    if (this.debug) {
      logger.debug('Subscriber added', { key, count: this.subscribers.get(key)!.size });
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback as StateSubscriber);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }

      if (this.debug) {
        logger.debug('Subscriber removed', { key });
      }
    };
  }

  /**
   * Subscribe to all state changes
   */
  subscribeAll(callback: StateSubscriber): () => void {
    this.globalSubscribers.add(callback);

    if (this.debug) {
      logger.debug('Global subscriber added', { count: this.globalSubscribers.size });
    }

    // Return unsubscribe function
    return () => {
      this.globalSubscribers.delete(callback);

      if (this.debug) {
        logger.debug('Global subscriber removed');
      }
    };
  }

  /**
   * Get all state keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get state metadata
   */
  getMetadata(key: string): { version: number; updatedAt: number; dirty: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    return {
      version: entry.version,
      updatedAt: entry.updatedAt,
      dirty: entry.dirty
    };
  }

  /**
   * Load state from database
   */
  async load(key: string): Promise<boolean> {
    if (!this.persistence.enabled || !this.supabase) {
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from(this.persistence.tableName)
        .select('value, version, updated_at')
        .eq('key', key)
        .eq('session_id', this.persistence.sessionId || '')
        .single();

      if (error || !data) {
        if (this.debug) {
          logger.debug('State not found in database', { key, error: error?.message });
        }
        return false;
      }

      // Update cache
      const entry: StateEntry = {
        value: data.value,
        version: data.version,
        updatedAt: new Date(data.updated_at).getTime(),
        dirty: false
      };

      this.cache.set(key, entry);

      // Notify subscribers
      const event: StateChangeEvent = {
        key,
        oldValue: null,
        newValue: data.value,
        timestamp: entry.updatedAt,
        source: 'remote'
      };
      this.notifySubscribers(key, event);

      if (this.debug) {
        logger.debug('State loaded from database', { key, version: entry.version });
      }

      return true;
    } catch (error) {
      logger.error('Failed to load state from database', error as Error, { key });
      return false;
    }
  }

  /**
   * Flush all dirty state to database
   */
  async flush(): Promise<void> {
    if (!this.persistence.enabled || !this.supabase) {
      return;
    }

    const dirtyEntries = Array.from(this.cache.entries())
      .filter(([_, entry]) => entry.dirty);

    if (dirtyEntries.length === 0) {
      return;
    }

    if (this.debug) {
      logger.debug('Flushing dirty state', { count: dirtyEntries.length });
    }

    const promises = dirtyEntries.map(([key, entry]) =>
      this.persistToDatabase(key, entry)
    );

    await Promise.all(promises);
  }

  /**
   * Notify subscribers of state change
   */
  private notifySubscribers(key: string, event: StateChangeEvent): void {
    // Notify key-specific subscribers
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      for (const callback of keySubscribers) {
        try {
          callback(event);
        } catch (error) {
          logger.error('Subscriber callback error', error as Error, { key });
        }
      }
    }

    // Notify global subscribers
    for (const callback of this.globalSubscribers) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Global subscriber callback error', error as Error, { key });
      }
    }
  }

  /**
   * Schedule persistence to database
   */
  private schedulePersistence(key: string): void {
    // Cancel existing timer
    const existingTimer = this.persistenceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new timer
    const timer = setTimeout(() => {
      const entry = this.cache.get(key);
      if (entry && entry.dirty) {
        this.persistToDatabase(key, entry);
      }
      this.persistenceTimers.delete(key);
    }, this.persistence.debounceMs);

    this.persistenceTimers.set(key, timer);
  }

  /**
   * Persist state to database
   */
  private async persistToDatabase(key: string, entry: StateEntry): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from(this.persistence.tableName)
        .upsert({
          key,
          session_id: this.persistence.sessionId || '',
          value: entry.value,
          version: entry.version,
          updated_at: new Date(entry.updatedAt).toISOString()
        });

      if (error) {
        throw error;
      }

      // Mark as clean
      entry.dirty = false;

      if (this.debug) {
        logger.debug('State persisted to database', { key, version: entry.version });
      }
    } catch (error) {
      logger.error('Failed to persist state to database', error as Error, { key });
    }
  }

  /**
   * Delete state from database
   */
  private async deleteFromDatabase(key: string): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from(this.persistence.tableName)
        .delete()
        .eq('key', key)
        .eq('session_id', this.persistence.sessionId || '');

      if (error) {
        throw error;
      }

      if (this.debug) {
        logger.debug('State deleted from database', { key });
      }
    } catch (error) {
      logger.error('Failed to delete state from database', error as Error, { key });
    }
  }

  /**
   * Evict oldest entry from cache
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.updatedAt < oldestTime) {
        oldestTime = entry.updatedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);

      if (this.debug) {
        logger.debug('Evicted oldest cache entry', { key: oldestKey });
      }
    }
  }
}

/**
 * Singleton instance
 */
let stateManagerInstance: SDUIStateManager | null = null;

/**
 * Get or create state manager instance
 */
export function getSDUIStateManager(config?: SDUIStateManagerConfig): SDUIStateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new SDUIStateManager(config);
  }
  return stateManagerInstance;
}

/**
 * Reset state manager (for testing)
 */
export function resetSDUIStateManager(): void {
  if (stateManagerInstance) {
    stateManagerInstance.clear();
  }
  stateManagerInstance = null;
}
