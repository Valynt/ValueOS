export type AuthMode = 'user-scoped-rls' | 'service-role' | 'system-worker';

export type RetryBackoffStrategy = 'none' | 'fixed' | 'exponential';

export interface RetryBackoffPolicy {
  strategy: RetryBackoffStrategy;
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier?: number;
  jitter?: boolean;
}

export interface AdapterLogSchema {
  schema: 'valueos.adapter.log.v1';
  operation: string;
  component: string;
}

export interface AdapterExecutionContext {
  tenantId: string;
  authMode: AuthMode;
  retryPolicy: RetryBackoffPolicy;
  logSchema: AdapterLogSchema;
  traceId?: string;
}

export interface TypedFailure {
  code: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

export type AdapterResult<TData, TFailure extends TypedFailure = TypedFailure> =
  | { ok: true; data: TData }
  | { ok: false; failure: TFailure };

/**
 * Boundary declaration for the orchestration layer. Orchestration code may know:
 * - domain DTO inputs/outputs
 * - policy outcomes
 * - typed failures
 *
 * It may not depend on transport, DB-driver details, credentials, or retry internals.
 */
export interface InfraAdapter<TRequest, TResponse, TFailure extends TypedFailure = TypedFailure> {
  readonly adapterName: string;
  execute(request: TRequest, ctx: AdapterExecutionContext): Promise<AdapterResult<TResponse, TFailure>>;
}

export interface TenantScopedRequest {
  organizationId?: string;
  tenantId?: string;
}

export interface AdapterDecorator {
  <TRequest, TResponse, TFailure extends TypedFailure>(
    adapter: InfraAdapter<TRequest, TResponse, TFailure>,
  ): InfraAdapter<TRequest, TResponse, TFailure>;
}

export interface AdapterBoundaryResponsibilities {
  orchestrationLayerKnows: {
    domainDtos: true;
    policyOutcomes: true;
    typedFailures: true;
  };
  adapterLayerOwns: {
    transportDetails: true;
    dbDetails: true;
    authCredentials: true;
    retryMechanics: true;
  };
  mandatoryAdapterControls: {
    tenantScopingAssertions: true;
    structuredLogSchema: 'valueos.adapter.log.v1';
    retryBackoffPolicy: true;
    authModeDeclaration: true;
  };
}

export const ADAPTER_BOUNDARY_RESPONSIBILITIES: AdapterBoundaryResponsibilities = {
  orchestrationLayerKnows: {
    domainDtos: true,
    policyOutcomes: true,
    typedFailures: true,
  },
  adapterLayerOwns: {
    transportDetails: true,
    dbDetails: true,
    authCredentials: true,
    retryMechanics: true,
  },
  mandatoryAdapterControls: {
    tenantScopingAssertions: true,
    structuredLogSchema: 'valueos.adapter.log.v1',
    retryBackoffPolicy: true,
    authModeDeclaration: true,
  },
};
