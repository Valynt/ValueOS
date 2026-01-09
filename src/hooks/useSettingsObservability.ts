/**
 * Settings Observability Hooks
 * Phase 3: System Observability
 * 
 * Tracks and monitors settings operations for debugging and analytics
 */

import { useCallback, useEffect, useRef } from 'react';
import { logger } from '../lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface SettingsOperation {
  key: string;
  action: 'read' | 'write' | 'delete';
  scope: 'user' | 'team' | 'organization';
  timestamp: number;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface SettingsMetrics {
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  errorCount: number;
  lastError?: string;
}

// ============================================================================
// Settings Operation Tracker
// ============================================================================

class SettingsOperationTracker {
  private operations: SettingsOperation[] = [];
  private maxOperations = 100; // Keep last 100 operations

  track(operation: SettingsOperation) {
    this.operations.push(operation);
    
    // Keep only last N operations
    if (this.operations.length > this.maxOperations) {
      this.operations = this.operations.slice(-this.maxOperations);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const emoji = operation.success ? '✅' : '❌';
      console.log(
        `${emoji} Settings ${operation.action}:`,
        operation.key,
        operation.duration ? `(${operation.duration}ms)` : ''
      );
    }

    // Log errors
    if (!operation.success && operation.error) {
      logger.error('Settings operation failed', new Error(operation.error), {
        key: operation.key,
        action: operation.action,
        scope: operation.scope,
      });
    }
  }

  getMetrics(): SettingsMetrics {
    if (this.operations.length === 0) {
      return {
        totalOperations: 0,
        successRate: 100,
        averageDuration: 0,
        errorCount: 0,
      };
    }

    const successfulOps = this.operations.filter((op) => op.success);
    const failedOps = this.operations.filter((op) => !op.success);
    const opsWithDuration = this.operations.filter((op) => op.duration !== undefined);

    const totalDuration = opsWithDuration.reduce((sum, op) => sum + (op.duration || 0), 0);
    const averageDuration = opsWithDuration.length > 0
      ? totalDuration / opsWithDuration.length
      : 0;

    return {
      totalOperations: this.operations.length,
      successRate: (successfulOps.length / this.operations.length) * 100,
      averageDuration,
      errorCount: failedOps.length,
      lastError: failedOps[failedOps.length - 1]?.error,
    };
  }

  getRecentOperations(count: number = 10): SettingsOperation[] {
    return this.operations.slice(-count);
  }

  clear() {
    this.operations = [];
  }
}

// Global tracker instance
const globalTracker = new SettingsOperationTracker();

// ============================================================================
// Hook: useSettingsObservability
// ============================================================================

/**
 * Hook to track and monitor settings operations
 * 
 * @example
 * ```tsx
 * const { trackOperation, metrics } = useSettingsObservability();
 * 
 * const handleSave = async () => {
 *   const startTime = Date.now();
 *   try {
 *     await saveSetting('key', 'value');
 *     trackOperation({
 *       key: 'user.theme',
 *       action: 'write',
 *       scope: 'user',
 *       timestamp: startTime,
 *       duration: Date.now() - startTime,
 *       success: true,
 *     });
 *   } catch (error) {
 *     trackOperation({
 *       key: 'user.theme',
 *       action: 'write',
 *       scope: 'user',
 *       timestamp: startTime,
 *       duration: Date.now() - startTime,
 *       success: false,
 *       error: error.message,
 *     });
 *   }
 * };
 * ```
 */
export function useSettingsObservability() {
  const trackOperation = useCallback((operation: SettingsOperation) => {
    globalTracker.track(operation);
  }, []);

  const getMetrics = useCallback(() => {
    return globalTracker.getMetrics();
  }, []);

  const getRecentOperations = useCallback((count?: number) => {
    return globalTracker.getRecentOperations(count);
  }, []);

  return {
    trackOperation,
    getMetrics,
    getRecentOperations,
  };
}

// ============================================================================
// Hook: useSettingsPerformance
// ============================================================================

/**
 * Hook to measure settings operation performance
 * 
 * @example
 * ```tsx
 * const { startTimer, endTimer } = useSettingsPerformance();
 * 
 * const handleSave = async () => {
 *   const timerId = startTimer('user.theme', 'write');
 *   try {
 *     await saveSetting('user.theme', 'dark');
 *     endTimer(timerId, true);
 *   } catch (error) {
 *     endTimer(timerId, false, error.message);
 *   }
 * };
 * ```
 */
export function useSettingsPerformance() {
  const timers = useRef<Map<string, { key: string; action: string; startTime: number }>>(
    new Map()
  );
  const { trackOperation } = useSettingsObservability();

  const startTimer = useCallback(
    (key: string, action: 'read' | 'write' | 'delete', scope: 'user' | 'team' | 'organization' = 'user') => {
      const timerId = `${key}-${action}-${Date.now()}`;
      timers.current.set(timerId, {
        key,
        action,
        startTime: Date.now(),
      });
      return timerId;
    },
    []
  );

  const endTimer = useCallback(
    (timerId: string, success: boolean, error?: string, scope: 'user' | 'team' | 'organization' = 'user') => {
      const timer = timers.current.get(timerId);
      if (!timer) return;

      const duration = Date.now() - timer.startTime;
      
      trackOperation({
        key: timer.key,
        action: timer.action as any,
        scope,
        timestamp: timer.startTime,
        duration,
        success,
        error,
      });

      timers.current.delete(timerId);

      // Warn about slow operations (> 1 second)
      if (duration > 1000) {
        logger.warn('Slow settings operation detected', undefined, {
          key: timer.key,
          action: timer.action,
          duration,
        });
      }
    },
    [trackOperation]
  );

  return {
    startTimer,
    endTimer,
  };
}

// ============================================================================
// Hook: useSettingsDebugger
// ============================================================================

/**
 * Hook for debugging settings operations
 * Only active in development mode
 */
export function useSettingsDebugger(enabled: boolean = process.env.NODE_ENV === 'development') {
  const { getMetrics, getRecentOperations } = useSettingsObservability();

  useEffect(() => {
    if (!enabled) return;

    // Log metrics every 30 seconds
    const interval = setInterval(() => {
      const metrics = getMetrics();
      console.group('⚙️ Settings Metrics');
      console.log('Total Operations:', metrics.totalOperations);
      console.log('Success Rate:', `${metrics.successRate.toFixed(1)}%`);
      console.log('Average Duration:', `${metrics.averageDuration.toFixed(0)}ms`);
      console.log('Error Count:', metrics.errorCount);
      if (metrics.lastError) {
        console.log('Last Error:', metrics.lastError);
      }
      console.groupEnd();
    }, 30000);

    return () => clearInterval(interval);
  }, [enabled, getMetrics]);

  // Expose debug functions to window in development
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    (window as any).__settingsDebug = {
      getMetrics,
      getRecentOperations,
      logMetrics: () => {
        const metrics = getMetrics();
        console.table(metrics);
      },
      logRecentOperations: (count?: number) => {
        const operations = getRecentOperations(count);
        console.table(operations);
      },
    };

    return () => {
      delete (window as any).__settingsDebug;
    };
  }, [enabled, getMetrics, getRecentOperations]);
}

// ============================================================================
// Hook: useSettingsAudit
// ============================================================================

/**
 * Hook to audit settings changes for compliance
 */
export function useSettingsAudit() {
  const auditLog = useCallback(
    (
      key: string,
      oldValue: any,
      newValue: any,
      userId: string,
      scope: 'user' | 'team' | 'organization'
    ) => {
      logger.info('Settings changed', {
        key,
        oldValue,
        newValue,
        userId,
        scope,
        timestamp: new Date().toISOString(),
      });

      // Track in observability
      globalTracker.track({
        key,
        action: 'write',
        scope,
        timestamp: Date.now(),
        success: true,
      });
    },
    []
  );

  return {
    auditLog,
  };
}

// ============================================================================
// Export Global Tracker (for testing)
// ============================================================================

export { globalTracker };
