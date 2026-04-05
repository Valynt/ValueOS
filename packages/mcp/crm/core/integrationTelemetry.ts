import { logger } from '../../lib/logger';

export interface MCPIntegrationTelemetry {
  provider: string;
  tenant_id: string;
  operation: string;
  correlation_id: string;
  outcome: 'success' | 'failure' | 'started' | 'degraded';
  latency_ms?: number;
  retry_count?: number;
  queue_lag_ms?: number;
  reason?: string;
}

const counters = new Map<string, number>();
const latencySeries = new Map<string, number[]>();

function incrementCounter(key: string, value = 1): void {
  counters.set(key, (counters.get(key) || 0) + value);
}

export function recordMCPIntegrationTelemetry(entry: MCPIntegrationTelemetry): void {
  const baseKey = `${entry.provider}:${entry.tenant_id}:${entry.operation}`;
  incrementCounter(`${baseKey}:${entry.outcome}`);

  if (typeof entry.retry_count === 'number' && entry.retry_count > 0) {
    incrementCounter(`${baseKey}:retries`, entry.retry_count);
  }

  if (typeof entry.latency_ms === 'number' && entry.latency_ms >= 0) {
    const existing = latencySeries.get(baseKey) || [];
    existing.push(entry.latency_ms);
    if (existing.length > 500) {
      latencySeries.set(baseKey, existing.slice(-500));
    } else {
      latencySeries.set(baseKey, existing);
    }
  }

  logger.info('mcp_integration_event', {
    provider: entry.provider,
    tenant_id: entry.tenant_id,
    operation: entry.operation,
    correlation_id: entry.correlation_id,
    outcome: entry.outcome,
    latency_ms: entry.latency_ms,
    retry_count: entry.retry_count,
    queue_lag_ms: entry.queue_lag_ms,
    reason: entry.reason,
  });
}

export function getMCPIntegrationSnapshot(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}
