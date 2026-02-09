/**
 * Request Context Storage
 *
 * Uses AsyncLocalStorage to maintain request-scoped context (requestId, tenantId, etc.)
 * across the call stack.
 */
let storage = null;
/**
 * Initialize the context storage (Node.js only)
 */
export async function initializeContext() {
    if (typeof window === 'undefined') {
        try {
            const { AsyncLocalStorage } = await import('async_hooks');
            storage = new AsyncLocalStorage();
        }
        catch (err) {
            // We can't log here because of circular dependency with logger
            // console.warn('Failed to initialize AsyncLocalStorage', err);
        }
    }
}
/**
 * Run a function within a context
 */
export function runWithContext(context, fn) {
    if (storage) {
        return storage.run(context, fn);
    }
    return fn();
}
/**
 * Get the current context
 */
export function getContext() {
    if (storage) {
        return storage.getStore();
    }
    return undefined;
}
//# sourceMappingURL=context.js.map