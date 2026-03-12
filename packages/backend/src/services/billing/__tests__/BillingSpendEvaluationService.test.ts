import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { MessageBus } from '../../realtime/MessageBus.js';
import type { CreateCommunicationEvent } from '../../../types/CommunicationEvent.js';
import type { SpendThresholdEvent } from '../BillingSpendEvaluationService.js';
import type { TenantExecutionStateService } from '../TenantExecutionStateService.js';

vi.mock('lz-string', () => ({
  compress: (value: string) => value,
  decompress: (value: string) => value,
}));

vi.mock('uuid', () => ({
  v4: () => 'billing-threshold-message-id',
}));

let BillingSpendEvaluationServiceCtor: typeof import('../BillingSpendEvaluationService.js').BillingSpendEvaluationService;

beforeAll(async () => {
  const billingModule = await import('../BillingSpendEvaluationService.js');
  BillingSpendEvaluationServiceCtor = billingModule.BillingSpendEvaluationService;
});

type MessagePayload = Parameters<MessageBus['publishMessage']>[1];

describe('BillingSpendEvaluationService', () => {
  it('keeps MessageBus publish payload contract compatible at compile-time', () => {
    type ExpectedThresholdPayload = {
      event_type: 'alert';
      sender_id: string;
      recipient_ids: string[];
      recipient_agent: string;
      message_type: 'status_update';
      tenant_id: string;
      organization_id: string;
      content: string;
      payload: SpendThresholdEvent;
      metadata: {
        priority: 'high' | 'medium';
      };
    };

    expectTypeOf<MessagePayload>().toMatchTypeOf<CreateCommunicationEvent>();
    expectTypeOf<ExpectedThresholdPayload>().toMatchTypeOf<MessagePayload>();
  });

  it('emitThresholdEvent publishes billing threshold message with typed payload', async () => {
    const service = new BillingSpendEvaluationServiceCtor(
      {} as SupabaseClient,
      {} as TenantExecutionStateService,
    );

    const publishMessage = vi
      .spyOn((service as unknown as { messageBus: MessageBus }).messageBus, 'publishMessage')
      .mockResolvedValue('msg-1');

    const emitThresholdEvent = (
      service as unknown as {
        emitThresholdEvent: (
          organizationId: string,
          dailyLimit: number,
          dailySpend: number,
          usagePercent: number,
          threshold: 'warning' | 'critical',
        ) => Promise<SpendThresholdEvent>;
      }
    ).emitThresholdEvent.bind(service);

    const event = await emitThresholdEvent('org-123', 100, 88, 88, 'warning');

    expect(event).toMatchObject({
      organizationId: 'org-123',
      dailyLimit: 100,
      dailySpend: 88,
      usagePercent: 88,
      threshold: 'warning',
    });

    expect(publishMessage).toHaveBeenCalledWith(
      'billing.daily_spend.threshold',
      expect.objectContaining({
        event_type: 'alert',
        sender_id: 'billing-spend-evaluator',
        recipient_ids: ['billing-monitor'],
        recipient_agent: 'billing-monitor',
        message_type: 'status_update',
        tenant_id: 'org-123',
        organization_id: 'org-123',
        content: expect.stringContaining('warning threshold reached'),
        payload: expect.objectContaining({ organizationId: 'org-123', threshold: 'warning' }),
        metadata: { priority: 'medium' },
      }),
    );
  });
});
