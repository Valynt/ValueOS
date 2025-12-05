/**
 * Canvas Hooks
 * 
 * React hooks for canvas components to interact with the event bus
 */

import { useCallback, useContext, createContext } from 'react';
import { CanvasEvent } from './types';
import { CanvasEventBus, getGlobalEventBus } from './CanvasEventBus';

/**
 * Canvas context
 */
interface CanvasContextValue {
  canvasId: string;
  eventBus: CanvasEventBus;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
}

export const CanvasContext = createContext<CanvasContextValue | null>(null);

/**
 * Hook to emit canvas events
 * 
 * @example
 * ```tsx
 * const MyComponent = ({ componentId }) => {
 *   const emitEvent = useCanvasEvent(componentId);
 *   
 *   const handleClick = () => {
 *     emitEvent({ type: 'component_click', componentId, data: { foo: 'bar' } });
 *   };
 *   
 *   return <div onClick={handleClick}>Click me</div>;
 * };
 * ```
 */
export function useCanvasEvent(componentId?: string) {
  const context = useContext(CanvasContext);

  return useCallback(
    (event: CanvasEvent) => {
      const eventBus = context?.eventBus || getGlobalEventBus();
      const canvasId = context?.canvasId || 'default';

      // Auto-inject componentId if not in event
      const enrichedEvent: CanvasEvent =
        componentId && !('componentId' in event)
          ? { ...event, componentId } as any
          : event;

      eventBus.emit(enrichedEvent, canvasId, {
        sessionId: context?.sessionId,
        userId: context?.userId,
        tenantId: context?.tenantId,
      });
    },
    [context, componentId]
  );
}

/**
 * Hook to get canvas context
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { canvasId, sessionId } = useCanvasContext();
 *   
 *   return <div>Canvas: {canvasId}</div>;
 * };
 * ```
 */
export function useCanvasContext() {
  const context = useContext(CanvasContext);
  
  if (!context) {
    throw new Error('useCanvasContext must be used within CanvasContext.Provider');
  }
  
  return context;
}

/**
 * Hook to check if component is in canvas context
 */
export function useIsInCanvas(): boolean {
  const context = useContext(CanvasContext);
  return context !== null;
}
