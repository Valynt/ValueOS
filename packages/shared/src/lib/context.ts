/**
 * Request Context Storage
 *
 * Uses AsyncLocalStorage to maintain request-scoped context (requestId, tenantId, etc.)
 * across the call stack.
 */

export interface RequestContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

let storage: any = null;

/**
 * Initialize the context storage (Node.js only)
 */
export async function initializeContext(): Promise<void> {
  if (typeof (globalThis as Record<string, unknown>)['window'] === 'undefined') {
    try {
      const { AsyncLocalStorage } = await import('async_hooks');
      storage = new AsyncLocalStorage<RequestContext>();
    } catch (err) {
       // We can't log here because of circular dependency with logger
       // console.warn('Failed to initialize AsyncLocalStorage', err);
    }
  }
}

/**
 * Run a function within a context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  if (storage) {
    return storage.run(context, fn);
  }
  return fn();
}

/**
 * Get the current context
 */
export function getContext(): RequestContext | undefined {
  if (storage) {
    return storage.getStore();
  }
  return undefined;
}
