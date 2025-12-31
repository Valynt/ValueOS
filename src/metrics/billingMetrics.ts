import { Counter } from 'prom-client';
import { getMetricsRegistry } from '../middleware/metricsMiddleware';

const registry = getMetricsRegistry();

type StripeWebhookLabels = {
  event_type: string;
  status: string;
};

type InvoiceLabels = {
  event_type: string;
};

type JobFailureLabels = {
  job: string;
  reason: string;
};

const stripeWebhooksTotal = new Counter<StripeWebhookLabels>({
  name: 'billing_stripe_webhooks_total',
  help: 'Stripe webhooks processed by the billing pipeline',
  labelNames: ['event_type', 'status'],
  registers: [registry],
});

const billingInvoicesProcessedTotal = new Counter<InvoiceLabels>({
  name: 'billing_invoices_processed_total',
  help: 'Invoice-related Stripe events processed by the billing pipeline',
  labelNames: ['event_type'],
  registers: [registry],
});

const billingJobsFailuresTotal = new Counter<JobFailureLabels>({
  name: 'billing_jobs_failures_total',
  help: 'Billing job failures by job and reason',
  labelNames: ['job', 'reason'],
  registers: [registry],
});

export function recordStripeWebhook(eventType: string, status: 'received' | 'processed' | 'failed'): void {
  stripeWebhooksTotal.labels({ event_type: eventType, status }).inc();
}

export function recordInvoiceEvent(eventType: string): void {
  billingInvoicesProcessedTotal.labels({ event_type: eventType }).inc();
}

export function recordBillingJobFailure(job: string, reason: string): void {
  billingJobsFailuresTotal.labels({ job, reason }).inc();
}
