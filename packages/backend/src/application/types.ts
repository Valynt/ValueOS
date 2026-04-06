/**
 * Application Layer — Core Types
 *
 * Defines the standard UseCase interface and RequestContext that all use cases
 * must implement. This enforces the Clean Architecture boundary:
 *   route → useCase → (domain + agents + workflows)
 *
 * Routes are transport-only. All orchestration lives in Use Cases.
 */

// ============================================================================
// RequestContext
// ============================================================================

/**
 * Immutable context extracted from the authenticated HTTP request.
 * Passed to every use case to provide tenant, user, and trace information
 * without coupling use cases to the Express request object.
 */
export interface RequestContext {
  /** Canonical tenant identifier. Always organization_id — never tenant_id alone. */
  readonly organizationId: string;
  /** Authenticated user ID (Supabase auth.users.id). */
  readonly userId: string;
  /** User roles from JWT claims. */
  readonly roles: string[];
  /** Distributed trace ID for observability. */
  readonly traceId: string;
  /** Correlation ID for request-scoped logging. */
  readonly correlationId: string;
  /** Subscription tier for entitlement checks. */
  readonly planTier: string;
}

// ============================================================================
// UseCase Interface
// ============================================================================

/**
 * Standard Use Case interface.
 *
 * All application-layer orchestration must implement this interface.
 * Use cases coordinate domain services, agents, and workflows.
 * They must NOT directly access HTTP request/response objects.
 *
 * @typeParam I - Input type (validated by the route layer before passing)
 * @typeParam O - Output type (serialized by the route layer after returning)
 */
export interface UseCase<I, O> {
  execute(input: I, context: RequestContext): Promise<O>;
}

// ============================================================================
// UseCaseResult — standardized output wrapper
// ============================================================================

export interface UseCaseResult<T> {
  data: T;
  meta?: {
    traceId: string;
    durationMs?: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a RequestContext from an Express request.
 * Import this in route handlers to extract context before calling use cases.
 */
export function buildRequestContext(req: {
  organizationId?: string;
  userId?: string;
  user?: {
    id?: string;
    roles?: string[];
    role?: string;
    app_metadata?: { tier?: string };
    subscription_tier?: string;
    planTier?: string;
  };
  traceContext?: { traceId?: string };
  correlationId?: string;
  requestId?: string;
}): RequestContext {
  const organizationId = req.organizationId;
  if (!organizationId) {
    throw new Error(
      'RequestContext: organizationId is required. Ensure tenantContextMiddleware runs before use case dispatch.'
    );
  }

  const userId = req.userId ?? req.user?.id;
  if (!userId) {
    throw new Error(
      'RequestContext: userId is required. Ensure requireAuth runs before use case dispatch.'
    );
  }

  const roles: string[] = (() => {
    const r = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
    return Array.isArray(r) ? r : [r];
  })();

  const planTier =
    req.user?.app_metadata?.tier ??
    req.user?.subscription_tier ??
    req.user?.planTier ??
    'unknown';

  return {
    organizationId,
    userId,
    roles,
    traceId: req.traceContext?.traceId ?? req.correlationId ?? req.requestId ?? crypto.randomUUID(),
    correlationId: req.correlationId ?? req.requestId ?? crypto.randomUUID(),
    planTier,
  };
}
