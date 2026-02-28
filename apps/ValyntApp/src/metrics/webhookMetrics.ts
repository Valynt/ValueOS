import { Counter } from 'prom-client';

import { getMetricsRegistry } from '../middleware/metricsMiddleware';

const registry = getMetricsRegistry();

export type WebhookRejectionReason =
  | 'missing_signature'
  | 'invalid_signature'
  | 'stale_timestamp'
  | 'payload_too_large'
  | 'rate_limited'
  | 'persistence_failed';

type RejectionLabels = {
  reason: string;
};

const webhookRejectionsTotal = new Counter<RejectionLabels>({
  name: 'billing_webhook_rejections_total',
  help: 'Webhook requests rejected by reason',
  labelNames: ['reason'],
  registers: [registry],
});

export function recordWebhookRejection(reason: WebhookRejectionReason): void {
  webhookRejectionsTotal.labels({ reason }).inc();
}
