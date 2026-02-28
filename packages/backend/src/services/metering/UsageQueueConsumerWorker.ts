import { type SupabaseClient } from '@supabase/supabase-js';

import { createLogger } from '../../lib/logger.js';

import { MeteringQueue, type UsageQueueEvent } from './MeteringQueue.js';

const logger = createLogger({ component: 'UsageQueueConsumerWorker' });

export class UsageQueueConsumerWorker {
  private isRunning = false;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly queue: MeteringQueue = new MeteringQueue()
  ) {}

  async start(): Promise<void> {
    this.isRunning = true;
    const subscription = await this.queue.subscribe();

    logger.info('Usage queue consumer started');

    for await (const message of subscription) {
      if (!this.isRunning) {
        message.ack();
        continue;
      }

      try {
        const event = this.queue.decode(message);
        await this.persistEvent(event);
        message.ack();
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        const deliveryCount = message.info.deliveryCount;

        logger.error('Failed to process usage event', normalizedError, {
          deliveryCount,
          streamSequence: message.seq,
        });

        if (deliveryCount >= this.queue.getMaxDeliveries()) {
          await this.queue.publishToDlq(message, normalizedError.message);
          message.term();
        } else {
          const delayMs = this.queue.getRetryDelay(deliveryCount);
          message.nak(delayMs);
        }
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.queue.close();
  }

  async getLag(): Promise<number> {
    return this.queue.getQueueLag();
  }

  private async persistEvent(event: UsageQueueEvent): Promise<void> {
    const { error } = await this.supabase
      .from('usage_events')
      .upsert(
        {
          tenant_id: event.tenant_id,
          metric: event.metric,
          amount: event.amount,
          request_id: event.request_id,
          idempotency_key: event.idempotency_key,
          metadata: event.metadata,
          processed: false,
          timestamp: event.timestamp,
        },
        {
          onConflict: 'tenant_id,idempotency_key',
          ignoreDuplicates: true,
        }
      );

    if (error) {
      throw error;
    }
  }
}
