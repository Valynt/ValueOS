/**
 * WebSocket Data Source
 * 
 * Integrates WebSocket real-time data streams with the SDUI data binding system.
 * Supports channel subscriptions, data transformations, and automatic reconnection.
 */

import { WebSocketManager } from './WebSocketManager';
import { DataBinding, ResolvedBinding, TransformFunction } from '../DataBindingSchema';
import { DataSourceContext } from '../DataBindingSchema';
import { TenantContext } from '../TenantContext';

/**
 * Real-time data binding configuration
 */
export interface RealtimeDataBinding extends DataBinding {
  /**
   * WebSocket channel to subscribe to
   */
  $channel: string;

  /**
   * Whether to reconnect on disconnect
   */
  $reconnect?: boolean;

  /**
   * Filter function for incoming messages
   */
  $filter?: (data: any) => boolean;

  /**
   * Debounce interval in milliseconds
   */
  $debounce?: number;

  /**
   * Buffer size for historical data
   */
  $bufferSize?: number;
}

/**
 * Subscription state
 */
interface SubscriptionState {
  channel: string;
  unsubscribe: () => void;
  buffer: any[];
  lastUpdate: string;
  updateCount: number;
}

/**
 * WebSocket Data Source Service
 */
export class WebSocketDataSource {
  private wsManager: WebSocketManager;
  private subscriptions: Map<string, SubscriptionState> = new Map();
  private callbacks: Map<string, Set<(data: any) => void>> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
  }

  /**
   * Resolve real-time data binding
   */
  public async resolve(
    binding: RealtimeDataBinding,
    context: DataSourceContext,
    onUpdate: (data: any) => void
  ): Promise<ResolvedBinding> {
    try {
      // Ensure WebSocket is connected
      if (!this.wsManager.isConnected()) {
        await this.wsManager.connect();
      }

      // Create subscription key
      const subscriptionKey = this.createSubscriptionKey(binding, context);

      // Check if already subscribed
      if (!this.subscriptions.has(subscriptionKey)) {
        await this.createSubscription(binding, context, subscriptionKey);
      }

      // Add callback
      if (!this.callbacks.has(subscriptionKey)) {
        this.callbacks.set(subscriptionKey, new Set());
      }
      this.callbacks.get(subscriptionKey)!.add(onUpdate);

      // Get current value from buffer
      const subscription = this.subscriptions.get(subscriptionKey)!;
      const currentValue = this.getCurrentValue(subscription, binding);

      return {
        value: currentValue,
        success: true,
        timestamp: new Date().toISOString(),
        source: 'realtime_stream',
        cached: false,
      };
    } catch (error) {
      return {
        value: binding.$fallback,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        source: 'realtime_stream',
        cached: false,
      };
    }
  }

  /**
   * Create subscription
   */
  private async createSubscription(
    binding: RealtimeDataBinding,
    context: DataSourceContext,
    subscriptionKey: string
  ): Promise<void> {
    const channel = this.buildChannelName(binding, context);

    const unsubscribe = this.wsManager.subscribe(
      channel,
      (data) => this.handleMessage(subscriptionKey, binding, data),
      binding.$filter
    );

    this.subscriptions.set(subscriptionKey, {
      channel,
      unsubscribe,
      buffer: [],
      lastUpdate: new Date().toISOString(),
      updateCount: 0,
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(
    subscriptionKey: string,
    binding: RealtimeDataBinding,
    data: any
  ): void {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;

    // Extract value from data
    const value = this.extractValue(data, binding.$bind);

    // Update buffer
    this.updateBuffer(subscription, value, binding.$bufferSize);

    // Update metadata
    subscription.lastUpdate = new Date().toISOString();
    subscription.updateCount++;

    // Notify callbacks
    if (binding.$debounce) {
      this.debounceNotify(subscriptionKey, binding.$debounce, value);
    } else {
      this.notifyCallbacks(subscriptionKey, value);
    }
  }

  /**
   * Extract value from data using path
   */
  private extractValue(data: any, path: string): any {
    const parts = path.split('.');
    let value = data;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Update buffer
   */
  private updateBuffer(
    subscription: SubscriptionState,
    value: any,
    bufferSize: number = 1
  ): void {
    subscription.buffer.push(value);
    if (subscription.buffer.length > bufferSize) {
      subscription.buffer.shift();
    }
  }

  /**
   * Get current value
   */
  private getCurrentValue(
    subscription: SubscriptionState,
    binding: RealtimeDataBinding
  ): any {
    if (subscription.buffer.length === 0) {
      return binding.$fallback;
    }

    // Return latest value or entire buffer
    if (binding.$bufferSize && binding.$bufferSize > 1) {
      return subscription.buffer;
    }

    return subscription.buffer[subscription.buffer.length - 1];
  }

  /**
   * Debounce notify
   */
  private debounceNotify(
    subscriptionKey: string,
    debounceMs: number,
    value: any
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(subscriptionKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.notifyCallbacks(subscriptionKey, value);
      this.debounceTimers.delete(subscriptionKey);
    }, debounceMs);

    this.debounceTimers.set(subscriptionKey, timer);
  }

  /**
   * Notify callbacks
   */
  private notifyCallbacks(subscriptionKey: string, value: any): void {
    const callbacks = this.callbacks.get(subscriptionKey);
    if (callbacks) {
      callbacks.forEach((callback) => callback(value));
    }
  }

  /**
   * Unsubscribe from data binding
   */
  public unsubscribe(
    binding: RealtimeDataBinding,
    context: DataSourceContext,
    callback: (data: any) => void
  ): void {
    const subscriptionKey = this.createSubscriptionKey(binding, context);
    const callbacks = this.callbacks.get(subscriptionKey);

    if (callbacks) {
      callbacks.delete(callback);

      // If no more callbacks, unsubscribe from channel
      if (callbacks.size === 0) {
        const subscription = this.subscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.unsubscribe();
          this.subscriptions.delete(subscriptionKey);
        }
        this.callbacks.delete(subscriptionKey);

        // Clear debounce timer
        const timer = this.debounceTimers.get(subscriptionKey);
        if (timer) {
          clearTimeout(timer);
          this.debounceTimers.delete(subscriptionKey);
        }
      }
    }
  }

  /**
   * Create subscription key
   */
  private createSubscriptionKey(
    binding: RealtimeDataBinding,
    context: DataSourceContext
  ): string {
    return `${context.organizationId}:${binding.$channel}:${binding.$bind}`;
  }

  /**
   * Build channel name with tenant context
   */
  private buildChannelName(
    binding: RealtimeDataBinding,
    context: DataSourceContext
  ): string {
    // Include tenant/org in channel name for isolation
    const tenantId = context.metadata?.tenantId || context.organizationId;
    return `${tenantId}:${binding.$channel}`;
  }

  /**
   * Get subscription statistics
   */
  public getStats(): {
    subscriptions: number;
    totalUpdates: number;
    channels: string[];
  } {
    let totalUpdates = 0;
    const channels: string[] = [];

    this.subscriptions.forEach((sub) => {
      totalUpdates += sub.updateCount;
      channels.push(sub.channel);
    });

    return {
      subscriptions: this.subscriptions.size,
      totalUpdates,
      channels,
    };
  }

  /**
   * Clear all subscriptions
   */
  public clearAll(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.callbacks.clear();
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

/**
 * React hook for real-time data binding
 */
export function useRealtimeBinding(
  binding: RealtimeDataBinding,
  context: DataSourceContext,
  wsDataSource: WebSocketDataSource
): {
  value: any;
  loading: boolean;
  error: Error | null;
  lastUpdate: string | null;
} {
  const [value, setValue] = React.useState<any>(binding.$fallback);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const handleUpdate = (newValue: any) => {
      if (mounted) {
        setValue(newValue);
        setLastUpdate(new Date().toISOString());
        setLoading(false);
      }
    };

    wsDataSource
      .resolve(binding, context, handleUpdate)
      .then((result) => {
        if (mounted) {
          if (result.success) {
            setValue(result.value);
            setLastUpdate(result.timestamp);
          } else {
            setError(new Error(result.error));
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      wsDataSource.unsubscribe(binding, context, handleUpdate);
    };
  }, [binding.$channel, binding.$bind]);

  return { value, loading, error, lastUpdate };
}

// Import React for the hook
import React from 'react';

export default WebSocketDataSource;
