/**
 * Canvas → Agent Event System
 * 
 * Allows canvas components to send events back to the agent
 * for bidirectional interaction
 * 
 * @example
 * ```typescript
 * const eventBus = new CanvasEventBus();
 * 
 * // Subscribe to events (in chat component)
 * eventBus.subscribe((event) => {
 *   sendToAgent({ type: 'canvas_event', payload: event });
 * });
 * 
 * // Emit event (in canvas component)
 * eventBus.emit({
 *   type: 'drill_down',
 *   metric: 'revenue',
 *   context: { quarter: 'Q4' },
 * }, 'canvas_v1');
 * ```
 */

import { CanvasEvent, CanvasEventPayload } from './types';
import { logger } from '../../lib/logger';

export type CanvasEventListener = (event: CanvasEventPayload) => void;

export class CanvasEventBus {
  private listeners: Array<{
    id: string;
    callback: CanvasEventListener;
    eventTypes?: CanvasEvent['type'][];
  }> = [];

  private eventCounter = 0;

  /**
   * Emit an event from canvas to agent
   */
  emit(
    event: CanvasEvent,
    canvasId: string,
    options?: {
      sessionId?: string;
      userId?: string;
      tenantId?: string;
    }
  ): void {
    const payload: CanvasEventPayload = {
      event,
      canvasId,
      timestamp: Date.now(),
      sessionId: options?.sessionId,
      userId: options?.userId,
      tenantId: options?.tenantId,
    };

    logger.debug('Canvas event emitted', {
      eventType: event.type,
      canvasId,
      sessionId: options?.sessionId,
    });

    // Notify matching listeners
    this.listeners.forEach(listener => {
      // Filter by event type if specified
      if (listener.eventTypes && !listener.eventTypes.includes(event.type)) {
        return;
      }

      try {
        listener.callback(payload);
      } catch (error) {
        logger.error('Canvas event listener error', error as Error, {
          listenerId: listener.id,
          eventType: event.type,
        });
      }
    });
  }

  /**
   * Subscribe to canvas events
   * 
   * @param callback - Function to call when event is emitted
   * @param eventTypes - Optional filter for specific event types
   * @returns Unsubscribe function
   */
  subscribe(
    callback: CanvasEventListener,
    eventTypes?: CanvasEvent['type'][]
  ): () => void {
    const listenerId = `listener_${++this.eventCounter}`;

    this.listeners.push({
      id: listenerId,
      callback,
      eventTypes,
    });

    logger.debug('Canvas event listener registered', {
      listenerId,
      eventTypes: eventTypes || 'all',
    });

    // Return unsubscribe function
    return () => {
      const index = this.listeners.findIndex(l => l.id === listenerId);
      if (index > -1) {
        this.listeners.splice(index, 1);
        logger.debug('Canvas event listener unregistered', { listenerId });
      }
    };
  }

  /**
   * Get number of active listeners
   */
  get listenerCount(): number {
    return this.listeners.length;
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    this.listeners = [];
    logger.info('All canvas event listeners cleared');
  }

  /**
   * Emit multiple events in batch
   */
  emitBatch(
    events: CanvasEvent[],
    canvasId: string,
    options?: {
      sessionId?: string;
      userId?: string;
      tenantId?: string;
    }
  ): void {
    events.forEach(event => this.emit(event, canvasId, options));
  }
}

/**
 * Global singleton instance
 */
let globalEventBus: CanvasEventBus | null = null;

/**
 * Get or create global event bus
 */
export function getGlobalEventBus(): CanvasEventBus {
  if (!globalEventBus) {
    globalEventBus = new CanvasEventBus();
  }
  return globalEventBus;
}

/**
 * Reset global event bus (for testing)
 */
export function resetGlobalEventBus(): void {
  globalEventBus = null;
}
