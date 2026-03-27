import { Counter, Gauge, type LabelValues } from 'prom-client';

import { getMetricsRegistry } from '../middleware/metricsMiddleware.js';

const registry = getMetricsRegistry();

type StripeWebhookLabelNames = 'event_type' | 'status';
type InvoiceLabelNames = 'event_type';
type JobFailureLabelNames = 'job' | 'reason';

const stripeWebhooksTotal = new Counter<StripeWebhookLabelNames>({
  name: 'billing_stripe_webhooks_total',
  help: 'Stripe webhooks processed by the billing pipeline',
  labelNames: ['event_type', 'status'],
  registers: [registry],
});

const billingInvoicesProcessedTotal = new Counter<InvoiceLabelNames>({
  name: 'billing_invoices_processed_total',
  help: 'Invoice-related Stripe events processed by the billing pipeline',
  labelNames: ['event_type'],
  registers: [registry],
});

const billingJobsFailuresTotal = new Counter<JobFailureLabelNames>({
  name: 'billing_jobs_failures_total',
  help: 'Billing job failures by job and reason',
  labelNames: ['job', 'reason'],
  registers: [registry],
});

// ── Metrics referenced by billing-alerts.yaml ────────────────────────────────
// These must be emitted by the backend for alert rules to fire.

/** Number of usage records not yet aggregated into billing_aggregates. */
export const billingUsageRecordsUnaggregated = new Gauge({
  name: 'billing_usage_records_unaggregated',
  help: 'Count of usage_events rows pending aggregation',
  registers: [registry],
});

/** Total Stripe submission errors (incremented on each failed Stripe API call). */
export const billingStripeSubmissionErrorsTotal = new Counter({
  name: 'billing_stripe_submission_errors_total',
  help: 'Stripe usage submission errors',
  registers: [registry],
});

/** Current size of the webhook retry queue (pending retries in webhook_events). */
export const billingWebhookRetryQueueSize = new Gauge({
  name: 'billing_webhook_retry_queue_size',
  help: 'Number of webhook events pending retry',
  registers: [registry],
});

/** Age in seconds of the oldest pending billing aggregate. */
export const billingPendingAggregatesAgeSeconds = new Gauge({
  name: 'billing_pending_aggregates_age_seconds',
  help: 'Age of the oldest un-aggregated usage record in seconds',
  registers: [registry],
});

/**
 * Count of payment_succeeded events where the Stripe customer had no matching
 * billing_customers row. Each increment means a tenant paid but their
 * enforcement state was not updated.
 */
export const billingWebhookUnresolvedTenantTotal = new Counter({
  name: 'billing_webhook_unresolved_tenant_total',
  help: 'payment_succeeded events where tenant could not be resolved from billing_customers',
  registers: [registry],
});

/** Aggregation windows skipped because another worker held the advisory lock. */
export const billingAggregationLockSkippedTotal = new Counter<'tenant_id' | 'metric'>({
  name: 'billing_aggregation_lock_skipped_total',
  help: 'Aggregation windows skipped due to advisory lock held by another worker',
  labelNames: ['tenant_id', 'metric'],
  registers: [registry],
});

/** Stripe calls prevented by pre-submission duplicate check. */
export const billingDuplicateSubmissionPreventedTotal = new Counter<'tenant_id' | 'metric'>({
  name: 'billing_duplicate_submission_prevented_total',
  help: 'Stripe calls skipped because an existing submitted aggregate was found',
  labelNames: ['tenant_id', 'metric'],
  registers: [registry],
});

/** Inbound usage events rejected by per-tenant Redis rate limiter. */
export const billingInboundRateLimitedTotal = new Counter<'tenant_id'>({
  name: 'billing_inbound_rate_limited_total',
  help: 'Inbound usage events rejected by per-tenant rate limiter',
  labelNames: ['tenant_id'],
  registers: [registry],
});

/** Redis unavailability events on the billing rate limiter (fail-open path). */
export const billingRateLimitRedisUnavailableTotal = new Counter({
  name: 'billing_rate_limit_redis_unavailable_total',
  help: 'Rate limiter Redis unavailability events (fail-open path taken)',
  registers: [registry],
});

/** Stripe calls throttled by the global outbound token bucket. */
export const billingStripeRateLimitedTotal = new Counter({
  name: 'billing_stripe_rate_limited_total',
  help: 'Stripe API calls throttled by the global outbound token bucket',
  registers: [registry],
});

/** Webhook retry jobs exhausted (all attempts consumed). */
export const billingWebhookExhaustedTotal = new Counter<'event_type'>({
  name: 'billing_webhook_exhausted_total',
  help: 'Webhook retry jobs that exhausted all retry attempts',
  labelNames: ['event_type'],
  registers: [registry],
});

// ── Webhook reliability metrics (Sprint 1.3 / 1.5) ───────────────────────────

/** Total webhooks received at the ingest endpoint. */
export const webhooksReceivedTotal = new Counter<'event_type'>({
  name: 'webhooks_received_total',
  help: 'Stripe webhook events received at the ingest endpoint',
  labelNames: ['event_type'],
  registers: [registry],
});

/** Total webhooks processed, labelled by outcome. */
export const webhooksProcessedTotal = new Counter<'event_type' | 'status'>({
  name: 'webhooks_processed_total',
  help: 'Stripe webhook events processed, by event_type and status (success|duplicate|failed)',
  labelNames: ['event_type', 'status'],
  registers: [registry],
});

/** Current number of permanently-failed webhook events in the DLQ. */
export const webhookDlqSize = new Gauge({
  name: 'webhook_dlq_size',
  help: 'Number of webhook events with status=failed (dead-letter queue depth)',
  registers: [registry],
});

/** Total webhook processing failures (handler threw). */
export const webhookProcessingFailuresTotal = new Counter<'event_type'>({
  name: 'webhook_processing_failures_total',
  help: 'Webhook events that failed during handler execution',
  labelNames: ['event_type'],
  registers: [registry],
});

/** Total reconciliation job runs. */
export const webhookReconciliationRunsTotal = new Counter({
  name: 'webhook_reconciliation_runs_total',
  help: 'Total Stripe↔DB reconciliation job executions',
  registers: [registry],
});

/** Total reconciliation job failures. */
export const webhookReconciliationFailuresTotal = new Counter({
  name: 'webhook_reconciliation_failures_total',
  help: 'Stripe↔DB reconciliation jobs that failed',
  registers: [registry],
});

/** Current drift count from the last reconciliation run, per tenant. */
export const webhookReconciliationDriftCount = new Gauge<'tenant_id'>({
  name: 'webhook_reconciliation_drift_count',
  help: 'Number of Stripe events not found in DB during last reconciliation, per tenant',
  labelNames: ['tenant_id'],
  registers: [registry],
});

// ─────────────────────────────────────────────────────────────────────────────

export function recordStripeWebhook(eventType: string, status: 'received' | 'processed' | 'failed' | 'duplicate'): void {
  stripeWebhooksTotal.labels({ event_type: eventType, status }).inc();
}

export function recordInvoiceEvent(eventType: string): void {
  billingInvoicesProcessedTotal.labels({ event_type: eventType }).inc();
}

export function recordBillingJobFailure(job: string, reason: string): void {
  billingJobsFailuresTotal.labels({ job, reason }).inc();
}

export function recordStripeSubmissionError(): void {
  billingStripeSubmissionErrorsTotal.inc();
}

export function recordWebhookUnresolvedTenant(): void {
  billingWebhookUnresolvedTenantTotal.inc();
}
