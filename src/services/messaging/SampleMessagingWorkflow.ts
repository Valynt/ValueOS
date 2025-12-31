import { logger } from '../../utils/logger';
import { redisStreamBroker, StreamEvent } from './RedisStreamBroker';
import { EventPayloadMap } from './EventSchemas';

const messageLogger = logger.withContext({ component: 'sample-messaging-workflow' });

export async function enqueueEmailNotification(input: {
  tenantId: string;
  recipient: string;
  template: string;
  variables: Record<string, any>;
  idempotencyKey: string;
}): Promise<string> {
  return redisStreamBroker.publish('notifications.email.requested', {
    schemaVersion: '1.0.0',
    emittedAt: new Date().toISOString(),
    ...input,
  });
}

export async function enqueueDataExport(input: {
  tenantId: string;
  exportType: string;
  requestedBy: string;
  filters?: Record<string, any>;
  idempotencyKey: string;
}): Promise<string> {
  return redisStreamBroker.publish('data.export.requested', {
    schemaVersion: '1.0.0',
    emittedAt: new Date().toISOString(),
    filters: input.filters || {},
    notifyOnCompletion: {
      channels: ['email'],
    },
    ...input,
  });
}

export async function startSampleWorker(): Promise<void> {
  await redisStreamBroker.startConsumer(async (event: StreamEvent<any>) => {
    switch (event.name) {
      case 'notifications.email.requested':
        await handleEmailRequest(event as StreamEvent<'notifications.email.requested'>);
        break;
      case 'notifications.webhook.dispatch':
        await handleWebhookDispatch(event as StreamEvent<'notifications.webhook.dispatch'>);
        break;
      case 'data.export.requested':
        await handleExportRequest(event as StreamEvent<'data.export.requested'>);
        break;
      case 'billing.usage.reported':
        await handleUsageReported(event as StreamEvent<'billing.usage.reported'>);
        break;
      default:
        messageLogger.warn('Unhandled event type', { eventName: event.name });
    }
  });
}

async function handleEmailRequest(event: StreamEvent<'notifications.email.requested'>): Promise<void> {
  messageLogger.info('Dispatching email notification', {
    recipient: event.payload.recipient,
    template: event.payload.template,
    attempt: event.attempt,
  });

  await simulateSideEffect('email-delivery');
}

async function handleWebhookDispatch(event: StreamEvent<'notifications.webhook.dispatch'>): Promise<void> {
  if (event.attempt > 0) {
    messageLogger.warn('Retrying webhook dispatch', {
      targetUrl: event.payload.targetUrl,
      attempt: event.attempt,
    });
  }

  await simulateSideEffect('webhook-dispatch');
}

async function handleExportRequest(event: StreamEvent<'data.export.requested'>): Promise<void> {
  messageLogger.info('Processing export request', {
    exportType: event.payload.exportType,
    requestedBy: event.payload.requestedBy,
  });

  await simulateSideEffect('data-export');
}

async function handleUsageReported(event: StreamEvent<'billing.usage.reported'>): Promise<void> {
  messageLogger.debug('Recording billing usage', {
    tenantId: event.payload.tenantId,
    window: `${event.payload.periodStart}-${event.payload.periodEnd}`,
  });

  await simulateSideEffect('billing-write');
}

async function simulateSideEffect(name: keyof EventPayloadMap | string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 10));
  messageLogger.debug('Side effect completed', { name });
}
