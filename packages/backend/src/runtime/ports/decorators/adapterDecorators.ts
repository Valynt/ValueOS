import { logger } from '../../../lib/logger.js';

import type {
  AdapterExecutionContext,
  AdapterResult,
  InfraAdapter,
  TenantScopedRequest,
  TypedFailure,
} from '../Contract.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, ctx: AdapterExecutionContext): number {
  const { strategy, initialDelayMs, maxDelayMs, multiplier = 2 } = ctx.retryPolicy;

  if (strategy === 'none') {
    return 0;
  }

  const unboundedDelay = strategy === 'fixed'
    ? initialDelayMs
    : initialDelayMs * Math.pow(multiplier, Math.max(attempt - 1, 0));

  return Math.min(unboundedDelay, maxDelayMs);
}

export function withTenantScopeGuard<TRequest extends TenantScopedRequest, TResponse, TFailure extends TypedFailure>(
  adapter: InfraAdapter<TRequest, TResponse, TFailure>,
): InfraAdapter<TRequest, TResponse, TFailure> {
  return {
    adapterName: `${adapter.adapterName}.tenant-guard`,
    async execute(request: TRequest, ctx: AdapterExecutionContext): Promise<AdapterResult<TResponse, TFailure>> {
      const requestTenant = request.organizationId ?? request.tenantId;
      if (!requestTenant || requestTenant !== ctx.tenantId) {
        return {
          ok: false,
          failure: {
            code: 'TENANT_SCOPE_VIOLATION',
            message: `Tenant mismatch for adapter ${adapter.adapterName}`,
            retryable: false,
            metadata: {
              requestTenant,
              contextTenant: ctx.tenantId,
              adapter: adapter.adapterName,
            },
          } as TFailure,
        };
      }

      return adapter.execute(request, ctx);
    },
  };
}

export function withStructuredLogging<TRequest, TResponse, TFailure extends TypedFailure>(
  adapter: InfraAdapter<TRequest, TResponse, TFailure>,
): InfraAdapter<TRequest, TResponse, TFailure> {
  return {
    adapterName: `${adapter.adapterName}.logging`,
    async execute(request: TRequest, ctx: AdapterExecutionContext): Promise<AdapterResult<TResponse, TFailure>> {
      const startedAt = Date.now();
      logger.info('Adapter execution started', {
        schema: ctx.logSchema.schema,
        operation: ctx.logSchema.operation,
        component: ctx.logSchema.component,
        adapter: adapter.adapterName,
        tenant_id: ctx.tenantId,
        auth_mode: ctx.authMode,
        trace_id: ctx.traceId,
      });

      const result = await adapter.execute(request, ctx);
      const durationMs = Date.now() - startedAt;

      if (result.ok) {
        logger.info('Adapter execution succeeded', {
          schema: ctx.logSchema.schema,
          operation: ctx.logSchema.operation,
          component: ctx.logSchema.component,
          adapter: adapter.adapterName,
          tenant_id: ctx.tenantId,
          auth_mode: ctx.authMode,
          trace_id: ctx.traceId,
          duration_ms: durationMs,
        });
      } else {
        logger.warn('Adapter execution failed', {
          schema: ctx.logSchema.schema,
          operation: ctx.logSchema.operation,
          component: ctx.logSchema.component,
          adapter: adapter.adapterName,
          tenant_id: ctx.tenantId,
          auth_mode: ctx.authMode,
          trace_id: ctx.traceId,
          duration_ms: durationMs,
          failure_code: result.failure.code,
          retryable: result.failure.retryable,
        });
      }

      return result;
    },
  };
}

export function withRetry<TRequest, TResponse, TFailure extends TypedFailure>(
  adapter: InfraAdapter<TRequest, TResponse, TFailure>,
): InfraAdapter<TRequest, TResponse, TFailure> {
  return {
    adapterName: `${adapter.adapterName}.retry`,
    async execute(request: TRequest, ctx: AdapterExecutionContext): Promise<AdapterResult<TResponse, TFailure>> {
      const maxAttempts = Math.max(1, ctx.retryPolicy.maxAttempts);

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const result = await adapter.execute(request, ctx);

        if (result.ok || !result.failure.retryable || attempt === maxAttempts) {
          return result;
        }

        const delayMs = computeDelay(attempt, ctx);
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }

      return {
        ok: false,
        failure: {
          code: 'RETRY_POLICY_EXHAUSTED',
          message: `Retry policy exhausted for adapter ${adapter.adapterName}`,
          retryable: false,
        } as TFailure,
      };
    },
  };
}

export function composeAdapter<TRequest, TResponse, TFailure extends TypedFailure>(
  base: InfraAdapter<TRequest, TResponse, TFailure>,
  decorators: Array<(adapter: InfraAdapter<TRequest, TResponse, TFailure>) => InfraAdapter<TRequest, TResponse, TFailure>>,
): InfraAdapter<TRequest, TResponse, TFailure> {
  return decorators.reduce((acc, decorator) => decorator(acc), base);
}
