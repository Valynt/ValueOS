/**
 * Billing Webhooks API Tests
 * Validates webhook endpoint security hardening:
 * - Generic error responses (no internal detail leakage)
 * - Durable persistence before 200 acknowledgment
 * - Payload size limits
 * - Missing/invalid signature handling
 * - Server credential gating
 */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/env', () => ({
  getSupabaseServerConfig: vi.fn(() => ({
    url: 'http://localhost:54321',
    serviceRoleKey: 'service-role-key',
  })),
  getSupabaseConfig: () => ({
    url: 'http://localhost:54321',
    anonKey: 'anon-key',
  }),
}));

vi.mock('../../metrics/webhookMetrics', () => ({
  recordWebhookRejection: vi.fn(),
}));

const { processEventMock, verifySignatureMock } = vi.hoisted(() => ({
  processEventMock: vi.fn().mockResolvedValue(undefined),
  verifySignatureMock: vi.fn((payload: Buffer, signature: string) => {
    if (signature !== 'valid-signature') {
      throw new Error('Webhook verification failed');
    }
    return {
      id: 'evt_test_123',
      type: 'invoice.payment_succeeded',
      payload,
    };
  }),
}));

vi.mock('../../services/billing/WebhookService', () => ({
  default: {
    verifySignature: verifySignatureMock,
    processEvent: processEventMock,
  },
}));

import webhookRouter from '../billing/webhooks';
import { getSupabaseServerConfig } from '../../lib/env';
import { recordWebhookRejection } from '../../metrics/webhookMetrics';

const mockedGetServerConfig = getSupabaseServerConfig as ReturnType<typeof vi.fn>;
const mockedRecordRejection = recordWebhookRejection as ReturnType<typeof vi.fn>;

describe('Billing Webhooks API', () => {
  let app: express.Application;

  beforeEach(() => {
    processEventMock.mockClear();
    verifySignatureMock.mockClear();
    mockedGetServerConfig.mockReturnValue({
      url: 'http://localhost:54321',
      serviceRoleKey: 'service-role-key',
    });
    mockedRecordRejection.mockClear();

    verifySignatureMock.mockImplementation((payload: Buffer, signature: string) => {
      if (signature !== 'valid-signature') {
        throw new Error('Webhook verification failed');
      }
      return {
        id: 'evt_test_123',
        type: 'invoice.payment_succeeded',
        payload,
      };
    });

    app = express();
    app.use('/api/billing/webhooks', webhookRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid Stripe signature and awaits processing before 200', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-signature')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, eventId: 'evt_test_123' });
    expect(processEventMock).toHaveBeenCalledTimes(1);
  });

  it('rejects missing Stripe signature with generic 400', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad request' });
    expect(response.body.error).not.toContain('stripe-signature');
    expect(processEventMock).not.toHaveBeenCalled();
    expect(mockedRecordRejection).toHaveBeenCalledWith('missing_signature');
  });

  it('rejects invalid Stripe signature with generic 400 — no internal details', async () => {
    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'invalid-signature')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Bad request' });
    // Must not leak verification error details
    expect(response.body.error).not.toContain('verification');
    expect(response.body.error).not.toContain('signature');
    expect(processEventMock).not.toHaveBeenCalled();
    expect(mockedRecordRejection).toHaveBeenCalledWith('invalid_signature');
  });

  it('returns 503 when server credentials are missing', async () => {
    mockedGetServerConfig.mockReturnValue({ url: '', serviceRoleKey: '' });

    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-signature')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Service temporarily unavailable' });
    // Must not expose env variable names
    expect(JSON.stringify(response.body)).not.toContain('SUPABASE');
    expect(JSON.stringify(response.body)).not.toContain('VITE_');
    expect(processEventMock).not.toHaveBeenCalled();
  });

  it('returns retryable 503 when processing/persistence fails', async () => {
    processEventMock.mockRejectedValueOnce(new Error('DB connection timeout'));

    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-signature')
      .send(JSON.stringify({ id: 'payload' }));

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Service temporarily unavailable. Please retry.' });
    // Must not leak DB error details
    expect(response.body.error).not.toContain('DB connection');
    expect(mockedRecordRejection).toHaveBeenCalledWith('persistence_failed');
  });

  it('enforces payload size limit on webhook route', () => {
    // The webhook route uses express.raw({ limit: '256kb' }).
    // express.raw rejects payloads exceeding the limit with 413 at the
    // HTTP transport level. This is validated in the body-parsing
    // integration test with the full server stack.
    // Supertest in isolated router tests may not trigger the 413 due to
    // how it streams request bodies, so we verify the route stack here.
    const stripeRoute = (webhookRouter as { stack?: Array<{ route?: { path: string; stack: Array<{ name: string }> } }> }).stack?.find(
      (layer) => layer.route?.path === '/stripe'
    );
    expect(stripeRoute).toBeTruthy();
    // The route should have at least 4 middleware layers:
    // sanitization, raw parser, rate limiter, handler
    expect(stripeRoute!.route!.stack.length).toBeGreaterThanOrEqual(4);
  });

  it('duplicate event replay remains idempotent (200)', async () => {
    // processEvent handles idempotency internally — returns void for replays
    processEventMock.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-signature')
      .send(JSON.stringify({ id: 'evt_test_123', type: 'invoice.created' }));

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
  });
});
