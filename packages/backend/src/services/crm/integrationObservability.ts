import { createLogger } from '../../lib/logger.js';
import { createCounter, createHistogram, createObservableGauge } from '../../lib/observability/index.js';
import { runInTelemetrySpanAsync } from '../../observability/telemetryStandards.js';

import type { CrmProvider } from './types.js';

const logger = createLogger({ component: 'CRMIntegrationObservability' });

export const integrationEventNames = [
  'connect_started',
  'connect_succeeded',
  'connect_failed',
  'webhook_rejected',
  'sync_degraded',
  'sync_recovered',
  'reauth_required',
  'sync_started',
  'sync_succeeded',
  'sync_failed',
] as const;

export type IntegrationEventName = (typeof integrationEventNames)[number];

const outcomeCounter = createCounter(
  'integration_operation_total',
  'Integration operation outcomes by provider/tenant/operation',
  ['service', 'provider', 'tenant_id', 'operation', 'outcome', 'event_name'],
);

const latencyHistogram = createHistogram(
  'integration_operation_latency_ms',
  'Integration operation latency in milliseconds',
  [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 30000],
  ['service', 'provider', 'tenant_id', 'operation'],
);

const retryCounter = createCounter(
  'integration_operation_retry_total',
  'Retry attempts recorded for integration operations',
  ['service', 'provider', 'tenant_id', 'operation'],
);

const queueLagGauge = createObservableGauge(
  'integration_queue_lag_ms',
  'Queue lag in milliseconds for integration jobs',
  ['service', 'provider', 'tenant_id', 'operation'],
);

const webhookBacklogGauge = createObservableGauge(
  'integration_webhook_backlog',
  'Pending CRM webhook backlog by tenant/provider',
  ['provider', 'tenant_id'],
);

export interface IntegrationLogContext {
  service: 'crm' | 'mcp';
  provider: CrmProvider | string;
  tenant_id: string;
  operation: string;
  correlation_id: string;
  outcome: 'success' | 'failure' | 'rejected' | 'degraded' | 'recovered' | 'started';
  event_name?: IntegrationEventName;
  retry_count?: number;
  queue_lag_ms?: number;
  latency_ms?: number;
  reason?: string;
}

export function logIntegrationEvent(context: IntegrationLogContext): void {
  logger.info('integration_event', context);

  outcomeCounter.inc(
    {
      service: context.service,
      provider: context.provider,
      tenant_id: context.tenant_id,
      operation: context.operation,
      outcome: context.outcome,
      event_name: context.event_name ?? 'none',
    },
    1,
  );

  if (typeof context.latency_ms === 'number' && context.latency_ms >= 0) {
    latencyHistogram.observe(
      {
        service: context.service,
        provider: context.provider,
        tenant_id: context.tenant_id,
        operation: context.operation,
      },
      context.latency_ms,
    );
  }

  if (typeof context.retry_count === 'number' && context.retry_count > 0) {
    retryCounter.inc(
      {
        service: context.service,
        provider: context.provider,
        tenant_id: context.tenant_id,
        operation: context.operation,
      },
      context.retry_count,
    );
  }

  if (typeof context.queue_lag_ms === 'number' && context.queue_lag_ms >= 0) {
    queueLagGauge.set(
      {
        service: context.service,
        provider: context.provider,
        tenant_id: context.tenant_id,
        operation: context.operation,
      },
      context.queue_lag_ms,
    );
  }
}

export function setWebhookBacklog(
  tenantId: string,
  provider: CrmProvider,
  backlog: number,
): void {
  webhookBacklogGauge.set(
    {
      provider,
      tenant_id: tenantId,
    },
    backlog,
  );
}

export async function withIntegrationTrace<T>(
  spanName: string,
  options: {
    provider: CrmProvider | string;
    tenant_id: string;
    operation: string;
    correlation_id: string;
  },
  operation: () => Promise<T>,
): Promise<T> {
  return runInTelemetrySpanAsync(
    spanName,
    {
      service: 'crm-integration',
      tenant_id: options.tenant_id,
      trace_id: options.correlation_id,
      attributes: {
        provider: options.provider,
        operation: options.operation,
        correlation_id: options.correlation_id,
      },
    },
    async () => operation(),
  );
}
