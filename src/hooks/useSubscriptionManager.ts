/**
 * Subscription Manager Hook
 *
 * Manages multiple subscriptions with automatic cleanup to prevent memory leaks.
 * Provides a unified interface for subscribing and unsubscribing from various services.
 */

import { useEffect, useRef } from 'react';

export type UnsubscribeFunction = () => void;

interface Subscription {
  id: string;
  unsubscribe: UnsubscribeFunction;
}

export class SubscriptionManager {
  private subscriptions: Map<string, UnsubscribeFunction> = new Map();
  private isCleanup = false;

  /**
   * Add a subscription with automatic cleanup
   */
  add(id: string, unsubscribe: UnsubscribeFunction): void {
    // Cleanup existing subscription if it exists
    if (this.subscriptions.has(id)) {
      this.cleanup(id);
    }

    this.subscriptions.set(id, unsubscribe);
  }

  /**
   * Remove and cleanup a specific subscription
   */
  cleanup(id: string): void {
    const unsubscribe = this.subscriptions.get(id);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Failed to cleanup subscription ${id}:`, error);
      }
      this.subscriptions.delete(id);
    }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanupAll(): void {
    this.isCleanup = true;
    for (const [id, unsubscribe] of this.subscriptions) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Failed to cleanup subscription ${id}:`, error);
      }
    }
    this.subscriptions.clear();
  }

  /**
   * Get active subscription count
   */
  get count(): number {
    return this.subscriptions.size;
  }

  /**
   * Check if cleanup is in progress
   */
  get cleaning(): boolean {
    return this.isCleanup;
  }
}

/**
 * Hook for managing subscriptions with automatic cleanup on unmount
 */
export function useSubscriptionManager() {
  const managerRef = useRef<SubscriptionManager | null>(null);

  // Initialize manager on first use
  if (!managerRef.current) {
    managerRef.current = new SubscriptionManager();
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.cleanupAll();
    };
  }, []);

  return managerRef.current;
}

/**
 * Utility hook for safe async operations with cleanup
 */
export function useSafeAsync() {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    isMounted: () => mountedRef.current,
    safeSetState: <T>(setter: (value: T) => void) => (value: T) => {
      if (mountedRef.current) {
        setter(value);
      }
    }
  };
}
