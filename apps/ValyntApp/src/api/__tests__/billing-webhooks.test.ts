/**
 * Billing Webhooks API Tests
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/env', () => ({
  getSupabaseConfig: () => ({
    url: 'http://localhost:54321',
    serviceRoleKey: 'service-role-key',
  }),
}));

const { processEventMock } = vi.hoisted(() => ({
  processEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/billing/WebhookService', () => ({
  default: {
    verifySignature: vi.fn((payload: Buffer, signature: string) => {
      if (signature !== 'valid-signature') {
        throw new Error('Webhook verification failed: invalid signature');
      }

      return {
        id: 'evt_test_123',
        type: 'invoice.payment_succeeded',
        payload,
      };
    }),
    processEvent: processEventMock,
  },
}));

import webhookRouter from '../billing/webhooks';

describe('Billing Webhooks API', () => {
  let app: express.Application;

  beforeEach(() => {
    processEventMock.mockClear();
    app = express();
    app.use('/api/billing/webhooks', webhookRouter);
  });

  it('accepts a valid Stripe signature without x-service-identity', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-signature')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, eventId: 'evt_test_123' });
    expect(processEventMock).toHaveBeenCalledTimes(1);
  });

  it('rejects missing Stripe signature', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Missing stripe-signature header' });
    expect(processEventMock).not.toHaveBeenCalled();
  });

  it('rejects invalid Stripe signature', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid-signature')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Webhook verification failed: invalid signature' });
    expect(processEventMock).not.toHaveBeenCalled();
  });
});
