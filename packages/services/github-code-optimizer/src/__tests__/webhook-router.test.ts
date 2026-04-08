import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    github: {
      webhookSecret: 'test-secret',
    },
  },
}));

vi.mock('../webhooks/handlers.js', () => ({
  webhookHandlers: {
    push: vi.fn().mockResolvedValue(undefined),
    pull_request: vi.fn().mockResolvedValue(undefined),
    installation: vi.fn().mockResolvedValue(undefined),
    installation_repositories: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

interface RawBodyRequest extends express.Request {
  rawBody?: Buffer;
}

const createSignature = (payload: string): string => {
  const digest = crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');
  return `sha256=${digest}`;
};

describe('webhook router signature verification', () => {
  it('accepts valid signed ping webhook requests', async () => {
    const { webhookRouter } = await import('../webhooks/router.js');
    const app = express();

    app.use(
      express.json({
        verify: (req: RawBodyRequest, _res, buf) => {
          req.rawBody = Buffer.from(buf);
        },
      })
    );
    app.use('/webhooks', webhookRouter);

    const payload = JSON.stringify({ zen: 'Keep it logically awesome.' });

    const response = await request(app)
      .post('/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'ping')
      .set('x-hub-signature-256', createSignature(payload))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('rejects ping webhook requests with invalid signature', async () => {
    const { webhookRouter } = await import('../webhooks/router.js');
    const app = express();

    app.use(
      express.json({
        verify: (req: RawBodyRequest, _res, buf) => {
          req.rawBody = Buffer.from(buf);
        },
      })
    );
    app.use('/webhooks', webhookRouter);

    const payload = JSON.stringify({ zen: 'Keep it logically awesome.' });

    const response = await request(app)
      .post('/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'ping')
      .set('x-hub-signature-256', `sha256=${'0'.repeat(64)}`)
      .send(payload);

    expect(response.status).toBe(401);
    expect(response.text).toBe('Invalid signature');
  });
});
