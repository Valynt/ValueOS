import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addServiceIdentityHeader, serviceIdentityMiddleware } from '../serviceIdentityMiddleware.js';

describe('service identity legacy token rejection integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      expectedAudience: 'valueos-backend',
      hmacKeys: [{ serviceId: 'agent-api', keyId: 'k1', secret: 'super-secret', audience: 'valueos-backend' }],
    });
    process.env.SERVICE_IDENTITY_CALLER_ID = 'agent-api';
    process.env.SERVICE_IDENTITY_REQUIRED = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function buildApp() {
    const app = express();
    app.use(express.json());

    const router = express.Router();
    router.use(serviceIdentityMiddleware);
    router.get('/health', (_req, res) => res.status(200).json({ ok: true }));
    router.post('/agents', (req, res) => res.status(200).json({ ok: true, echoed: req.body }));

    app.use('/internal', router);
    return app;
  }

  it('rejects GET and POST protected routes that only provide the legacy shared token', async () => {
    const app = buildApp();
    const timestamp = String(Date.now());

    const legacyGetResponse = await request(app)
      .get('/internal/health')
      .set('X-Service-Identity', 'legacy-shared-token')
      .set('X-Request-Timestamp', timestamp)
      .set('X-Request-Nonce', 'legacy-get-nonce');

    const legacyPostResponse = await request(app)
      .post('/internal/agents')
      .set('X-Service-Identity', 'legacy-shared-token')
      .set('X-Request-Timestamp', timestamp)
      .set('X-Request-Nonce', 'legacy-post-nonce')
      .send({ prompt: 'hello' });

    expect(legacyGetResponse.status).toBe(401);
    expect(legacyPostResponse.status).toBe(401);
  });

  it('accepts signed HMAC assertions for GET and POST protected routes', async () => {
    const app = buildApp();

    const getHeaders = addServiceIdentityHeader({}, {
      method: 'GET',
      path: '/internal/health',
      body: {},
    });
    const postHeaders = addServiceIdentityHeader({}, {
      method: 'POST',
      path: '/internal/agents',
      body: { prompt: 'hello' },
    });

    const signedGetResponse = await request(app)
      .get('/internal/health')
      .set(getHeaders);

    const signedPostResponse = await request(app)
      .post('/internal/agents')
      .set(postHeaders)
      .send({ prompt: 'hello' });

    expect(signedGetResponse.status).toBe(200);
    expect(signedPostResponse.status).toBe(200);
    expect(signedPostResponse.body.echoed).toEqual({ prompt: 'hello' });
  });
});
