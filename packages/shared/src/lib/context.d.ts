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
/**
 * Initialize the context storage (Node.js only)
 */
export declare function initializeContext(): Promise<void>;
/**
 * Run a function within a context
 */
export declare function runWithContext<T>(context: RequestContext, fn: () => T): T;
/**
 * Get the current context
 */
export declare function getContext(): RequestContext | undefined;
//# sourceMappingURL=context.d.ts.map