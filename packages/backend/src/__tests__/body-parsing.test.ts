import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/billing/WebhookService', () => ({
  default: {
    verifySignature: vi.fn(),
    processEvent: vi.fn(),
  },
}));

import app from '../server.js'
import WebhookService from '../services/billing/WebhookService.js'

vi.mock("../lib/supabase.js");

const mockedWebhookService = WebhookService as {
  verifySignature: ReturnType<typeof vi.fn>;
  processEvent: ReturnType<typeof vi.fn>;
};

describe('Body parsing regression', () => {
  beforeAll(() => {
    app.post('/__test__/json', (req, res) => {
      res.json({ body: req.body });
    });
  });

  afterEach(() => {
    mockedWebhookService.verifySignature.mockReset();
    mockedWebhookService.processEvent.mockReset();
  });

  it('parses JSON bodies for standard routes', async () => {
    const payload = { message: 'hello' };

    const response = await request(app)
      .post('/__test__/json')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.body).toEqual(payload);
  });

  it('keeps raw body for Stripe webhook signature verification', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'invoice.created',
    });

    mockedWebhookService.verifySignature.mockReturnValue({
      id: 'evt_test_123',
      type: 'invoice.created',
    });
    mockedWebhookService.processEvent.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/billing/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      received: true,
      eventId: 'evt_test_123',
    });
    expect(mockedWebhookService.verifySignature).toHaveBeenCalledTimes(1);
    const [rawBody, signature] = mockedWebhookService.verifySignature.mock.calls[0];
    expect(Buffer.isBuffer(rawBody)).toBe(true);
    expect(rawBody.toString()).toBe(payload);
    expect(signature).toBe('t=123,v1=abc');
  });
});
