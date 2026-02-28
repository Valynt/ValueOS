import { randomUUID } from 'crypto';

import { BillingMetric } from '../../config/billing.js';
import { createLogger } from '../../lib/logger.js';

import { MeteringQueue } from './MeteringQueue.js';

const logger = createLogger({ component: 'UsageQueueProducer' });

export interface PublishUsageEventInput {
  tenantId: string;
  metric: BillingMetric;
  amount: number;
  requestId: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export class UsageQueueProducer {
  constructor(private readonly queue: MeteringQueue = new MeteringQueue()) {}

  async publishUsageEvent(input: PublishUsageEventInput): Promise<void> {
    const event = {
      tenant_id: input.tenantId,
      metric: input.metric,
      amount: input.amount,
      request_id: input.requestId,
      idempotency_key: input.idempotencyKey || input.requestId,
      metadata: input.metadata || {},
      timestamp: new Date().toISOString(),
      event_id: randomUUID(),
    };

    await this.queue.publish(event);
    logger.debug('Published usage event to queue', {
      tenantId: input.tenantId,
      metric: input.metric,
      idempotencyKey: event.idempotency_key,
    });
  }
}
